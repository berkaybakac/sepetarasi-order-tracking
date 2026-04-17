import { SETTING_KEYS } from "@sepetarasi/shared";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { appSettings, orders } from "../src/db/schema.js";
import { createTestDb } from "../src/db/test-utils.js";
import { InvalidDeliveryAnalyticsRangeError, StatsService } from "../src/services/stats.service.js";

const tz = "Europe/Istanbul";
const originalStoreTimeZone = process.env.STORE_TIMEZONE;

afterEach(() => {
	if (originalStoreTimeZone == null) {
		process.env.STORE_TIMEZONE = undefined;
		return;
	}
	process.env.STORE_TIMEZONE = originalStoreTimeZone;
});

function businessDate(daysAgo: number): string {
	const d = new Date();
	d.setDate(d.getDate() - daysAgo);
	return d.toLocaleDateString("en-CA", { timeZone: tz });
}

function isoDate(daysAgo: number): string {
	return businessDate(daysAgo);
}

function makeDelivered(
	id: string,
	daysAgo: number,
	deliveryMinutes: number,
	overrides: Partial<typeof orders.$inferInsert> = {},
): typeof orders.$inferInsert {
	const deliveredAt = new Date();
	deliveredAt.setDate(deliveredAt.getDate() - daysAgo);
	deliveredAt.setHours(12, 0, 0, 0);
	const createdAt = new Date(deliveredAt.getTime() - deliveryMinutes * 60_000);
	return {
		id,
		business_date: businessDate(daysAgo),
		display_no: Number(id.replace(/\D/g, "")) || 1,
		status: "DELIVERED",
		created_at: createdAt.toISOString(),
		delivered_at: deliveredAt.toISOString(),
		updated_at: deliveredAt.toISOString(),
		...overrides,
	};
}

describe("StatsService.getDeliveryAnalytics()", () => {
	it("reads delivery_target_minutes from app_settings (SSOT)", () => {
		const db = createTestDb();
		db.update(appSettings)
			.set({ value: "25" })
			.where(eq(appSettings.key, SETTING_KEYS.DELIVERY_TARGET_MINUTES))
			.run();

		const svc = new StatsService(db);
		const r = svc.getDeliveryAnalytics(isoDate(0), isoDate(0));
		expect(r.summary.targetMinutes).toBe(25);
	});

	it("falls back to default target when setting missing", () => {
		const db = createTestDb();
		db.delete(appSettings).where(eq(appSettings.key, SETTING_KEYS.DELIVERY_TARGET_MINUTES)).run();

		const svc = new StatsService(db);
		const r = svc.getDeliveryAnalytics(isoDate(0), isoDate(0));
		expect(r.summary.targetMinutes).toBe(20);
	});

	it("only counts DELIVERED orders (excludes CANCELLED and PREPARING)", () => {
		const db = createTestDb();
		db.insert(orders)
			.values([
				makeDelivered("1", 0, 8),
				makeDelivered("2", 0, 12),
				{
					id: "3",
					business_date: businessDate(0),
					display_no: 3,
					status: "CANCELLED",
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
					delivered_at: new Date().toISOString(),
				},
				{
					id: "4",
					business_date: businessDate(0),
					display_no: 4,
					status: "PREPARING",
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				},
			])
			.run();

		const svc = new StatsService(db);
		const r = svc.getDeliveryAnalytics(isoDate(0), isoDate(0));
		expect(r.summary.totalDelivered).toBe(2);
		expect(r.summary.averageDeliveryMinutes).toBeCloseTo(10, 0);
	});

	it("picks hour granularity for short ranges (<= 2 days)", () => {
		const db = createTestDb();
		db.insert(orders)
			.values([makeDelivered("1", 0, 8)])
			.run();

		const svc = new StatsService(db);
		const r = svc.getDeliveryAnalytics(isoDate(0), isoDate(0));
		expect(r.timeSeries.granularity).toBe("hour");
	});

	it("picks day granularity for longer ranges", () => {
		const db = createTestDb();
		db.insert(orders)
			.values([makeDelivered("1", 0, 8), makeDelivered("2", 5, 9)])
			.run();

		const svc = new StatsService(db);
		const r = svc.getDeliveryAnalytics(isoDate(6), isoDate(0));
		expect(r.timeSeries.granularity).toBe("day");
	});

	it("computes onTargetRate against target", () => {
		const db = createTestDb();
		db.update(appSettings)
			.set({ value: "15" })
			.where(eq(appSettings.key, SETTING_KEYS.DELIVERY_TARGET_MINUTES))
			.run();
		db.insert(orders)
			.values([
				makeDelivered("1", 0, 10), // on target
				makeDelivered("2", 0, 12), // on target
				makeDelivered("3", 0, 20), // over
				makeDelivered("4", 0, 25), // over
			])
			.run();

		const svc = new StatsService(db);
		const r = svc.getDeliveryAnalytics(isoDate(0), isoDate(0));
		expect(r.summary.targetMinutes).toBe(15);
		expect(r.summary.onTargetCount).toBe(2);
		expect(r.summary.onTargetRate).toBe(50);
	});

	it("returns empty-state zeros when no deliveries exist", () => {
		const db = createTestDb();
		const svc = new StatsService(db);
		const r = svc.getDeliveryAnalytics(isoDate(0), isoDate(0));
		expect(r.summary.totalDelivered).toBe(0);
		expect(r.summary.averageDeliveryMinutes).toBe(0);
		expect(r.summary.onTargetRate).toBe(0);
		expect(r.timeSeries.points).toEqual([]);
		expect(r.distribution.every((b) => b.count === 0)).toBe(true);
		expect(r.byOrderType).toEqual([]);
	});

	it("compares against previous period of same length", () => {
		const db = createTestDb();
		db.insert(orders)
			.values([
				// current 7-day window
				makeDelivered("c1", 1, 10),
				makeDelivered("c2", 2, 10),
				// previous 7-day window (8-14 days ago)
				makeDelivered("p1", 8, 20),
				makeDelivered("p2", 9, 20),
			])
			.run();

		const svc = new StatsService(db);
		const r = svc.getDeliveryAnalytics(isoDate(6), isoDate(0));
		expect(r.summary.averageDeliveryMinutes).toBeCloseTo(10, 0);
		expect(r.summary.previousPeriodAvgMinutes).toBeCloseTo(20, 0);
		// Current is faster → trendPercent negative
		expect(r.summary.trendPercent).toBeLessThan(0);
	});

	it("buckets deliveries into distribution ranges", () => {
		const db = createTestDb();
		db.insert(orders)
			.values([
				makeDelivered("1", 0, 3), // 0-5dk
				makeDelivered("2", 0, 7), // 5-10dk
				makeDelivered("3", 0, 12), // 10-15dk
				makeDelivered("4", 0, 20), // 15+dk
			])
			.run();

		const svc = new StatsService(db);
		const r = svc.getDeliveryAnalytics(isoDate(0), isoDate(0));
		const byBucket = Object.fromEntries(r.distribution.map((d) => [d.bucket, d.count]));
		expect(byBucket["0-5dk"]).toBe(1);
		expect(byBucket["5-10dk"]).toBe(1);
		expect(byBucket["10-15dk"]).toBe(1);
		expect(byBucket["15+dk"]).toBe(1);
	});

	it("breaks down averages by order type", () => {
		const db = createTestDb();
		db.insert(orders)
			.values([
				makeDelivered("1", 0, 8, { order_type: "Paket" }),
				makeDelivered("2", 0, 12, { order_type: "Paket" }),
				makeDelivered("3", 0, 6, { order_type: "Masada" }),
			])
			.run();

		const svc = new StatsService(db);
		const r = svc.getDeliveryAnalytics(isoDate(0), isoDate(0));
		const paket = r.byOrderType.find((t) => t.orderType === "Paket");
		const masada = r.byOrderType.find((t) => t.orderType === "Masada");
		expect(paket?.deliveredCount).toBe(2);
		expect(paket?.averageDeliveryMinutes).toBeCloseTo(10, 0);
		expect(masada?.deliveredCount).toBe(1);
		expect(masada?.averageDeliveryMinutes).toBeCloseTo(6, 0);
	});

	it("rejects impossible calendar dates instead of normalizing them", () => {
		const db = createTestDb();
		const svc = new StatsService(db);

		expect(() => svc.getDeliveryAnalytics("2026-02-31", "2026-03-01")).toThrow(
			InvalidDeliveryAnalyticsRangeError,
		);
	});

	it("builds hourly buckets in STORE_TIMEZONE instead of server localtime", () => {
		process.env.STORE_TIMEZONE = "Europe/Istanbul";
		const db = createTestDb();

		db.insert(orders)
			.values([
				{
					id: "late-evening",
					business_date: "2026-04-17",
					display_no: 1,
					status: "DELIVERED",
					created_at: "2026-04-17T20:10:00.000Z",
					delivered_at: "2026-04-17T20:20:00.000Z",
					updated_at: "2026-04-17T20:20:00.000Z",
				},
				{
					id: "after-midnight",
					business_date: "2026-04-18",
					display_no: 2,
					status: "DELIVERED",
					created_at: "2026-04-17T21:05:00.000Z",
					delivered_at: "2026-04-17T21:15:00.000Z",
					updated_at: "2026-04-17T21:15:00.000Z",
				},
			])
			.run();

		const svc = new StatsService(db);
		const result = svc.getDeliveryAnalytics("2026-04-17", "2026-04-18");

		expect(result.timeSeries.granularity).toBe("hour");
		expect(result.timeSeries.points.map((point) => point.bucket)).toEqual([
			"2026-04-17T23:00",
			"2026-04-18T00:00",
		]);
	});
});
