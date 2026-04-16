import { describe, expect, it } from "vitest";
import { orders } from "../src/db/schema.js";
import { createTestDb } from "../src/db/test-utils.js";
import { StatsService } from "../src/services/stats.service.js";

const tz = "Europe/Istanbul";

function businessDate(daysAgo: number): string {
	const d = new Date();
	d.setDate(d.getDate() - daysAgo);
	return d.toLocaleDateString("en-CA", { timeZone: tz });
}

function makeOrder(
	overrides: Partial<typeof orders.$inferInsert> & { id: string },
): typeof orders.$inferInsert {
	return {
		business_date: businessDate(0),
		display_no: 1,
		status: "PREPARING",
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		...overrides,
	};
}

describe("StatsService.getByPeriod()", () => {
	it("daily: returns only today's orders", () => {
		const db = createTestDb();
		db.insert(orders)
			.values([
				makeOrder({
					id: "a",
					business_date: businessDate(0),
					display_no: 1,
					status: "READY",
					ready_at: new Date().toISOString(),
				}),
				makeOrder({ id: "b", business_date: businessDate(8), display_no: 1 }), // 8 days ago — outside weekly+daily
			])
			.run();

		const svc = new StatsService(db);
		const stats = svc.getByPeriod("daily");
		expect(stats.totalOrders).toBe(1);
	});

	it("weekly: includes orders from last 7 days", () => {
		const db = createTestDb();
		db.insert(orders)
			.values([
				makeOrder({ id: "a", business_date: businessDate(0), display_no: 1 }),
				makeOrder({ id: "b", business_date: businessDate(5), display_no: 1 }), // 5 days ago — inside
				makeOrder({ id: "c", business_date: businessDate(8), display_no: 1 }), // 8 days ago — outside
			])
			.run();

		const svc = new StatsService(db);
		const stats = svc.getByPeriod("weekly");
		expect(stats.totalOrders).toBe(2);
	});

	it("monthly: includes orders from last 30 days", () => {
		const db = createTestDb();
		db.insert(orders)
			.values([
				makeOrder({ id: "a", business_date: businessDate(0), display_no: 1 }),
				makeOrder({ id: "b", business_date: businessDate(29), display_no: 1 }), // inside
				makeOrder({ id: "c", business_date: businessDate(31), display_no: 1 }), // outside
			])
			.run();

		const svc = new StatsService(db);
		const stats = svc.getByPeriod("monthly");
		expect(stats.totalOrders).toBe(2);
	});

	it("excludes cancelled orders from totals and averages across all periods", () => {
		const db = createTestDb();
		const now = new Date();
		const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
		const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
		const currentTime = now.toISOString();

		db.insert(orders)
			.values([
				makeOrder({
					id: "ready-today",
					business_date: businessDate(0),
					display_no: 1,
					status: "READY",
					created_at: tenMinAgo,
					ready_at: currentTime,
				}),
				makeOrder({
					id: "cancelled-today",
					business_date: businessDate(0),
					display_no: 2,
					status: "CANCELLED",
					created_at: thirtyMinAgo,
					ready_at: currentTime,
					cancelled_at: currentTime,
				}),
				makeOrder({
					id: "preparing-weekly",
					business_date: businessDate(5),
					display_no: 1,
					status: "PREPARING",
				}),
				makeOrder({
					id: "delivered-monthly",
					business_date: businessDate(20),
					display_no: 1,
					status: "DELIVERED",
				}),
			])
			.run();

		const svc = new StatsService(db);
		const expectedTotals = {
			daily: 1,
			weekly: 2,
			monthly: 3,
		} as const;

		for (const period of ["daily", "weekly", "monthly"] as const) {
			const stats = svc.getByPeriod(period);
			expect(stats.totalOrders).toBe(expectedTotals[period]);
			expect(stats.byStatus.CANCELLED).toBe(1);
			expect(stats.averagePrepMinutes).not.toBeNull();
			expect(stats.averagePrepMinutes!).toBeGreaterThan(9);
			expect(stats.averagePrepMinutes!).toBeLessThan(12);
			expect(stats.averageDeliverySeconds).toBeNull();
		}
	});

	it("calculates averageDeliverySeconds with daily, weekly, and monthly filters", () => {
		const db = createTestDb();
		const deliveredAt = new Date();
		const deliveredAtIso = deliveredAt.toISOString();
		const createdDaily = new Date(deliveredAt.getTime() - 20 * 60 * 1000).toISOString();
		const createdWeekly = new Date(deliveredAt.getTime() - 10 * 60 * 1000).toISOString();
		const createdMonthly = new Date(deliveredAt.getTime() - 5 * 60 * 1000).toISOString();
		const createdOutsideMonthly = new Date(deliveredAt.getTime() - 60 * 60 * 1000).toISOString();

		db.insert(orders)
			.values([
				makeOrder({
					id: "delivered-daily",
					business_date: businessDate(0),
					display_no: 1,
					status: "DELIVERED",
					created_at: createdDaily,
					delivered_at: deliveredAtIso,
				}),
				makeOrder({
					id: "delivered-weekly",
					business_date: businessDate(5),
					display_no: 2,
					status: "DELIVERED",
					created_at: createdWeekly,
					delivered_at: deliveredAtIso,
				}),
				makeOrder({
					id: "delivered-monthly",
					business_date: businessDate(20),
					display_no: 3,
					status: "DELIVERED",
					created_at: createdMonthly,
					delivered_at: deliveredAtIso,
				}),
				makeOrder({
					id: "outside-monthly",
					business_date: businessDate(31),
					display_no: 4,
					status: "DELIVERED",
					created_at: createdOutsideMonthly,
					delivered_at: deliveredAtIso,
				}),
			])
			.run();

		const svc = new StatsService(db);
		expect(svc.getByPeriod("daily").averageDeliverySeconds).toBe(1200);
		expect(svc.getByPeriod("weekly").averageDeliverySeconds).toBe(900);
		expect(svc.getByPeriod("monthly").averageDeliverySeconds).toBe(700);
	});

	it("returns null averagePrepMinutes when no orders have ready_at", () => {
		const db = createTestDb();
		db.insert(orders)
			.values([makeOrder({ id: "a", display_no: 1, status: "PREPARING" })])
			.run();

		const svc = new StatsService(db);
		const stats = svc.getByPeriod("daily");
		expect(stats.averagePrepMinutes).toBeNull();
		expect(stats.averageDeliverySeconds).toBeNull();
	});

	it("calculates correct average prep time across multiple orders", () => {
		const db = createTestDb();
		const now = new Date();
		const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
		const twentyMinAgo = new Date(now.getTime() - 20 * 60 * 1000).toISOString();

		db.insert(orders)
			.values([
				makeOrder({
					id: "a",
					display_no: 1,
					status: "READY",
					created_at: twentyMinAgo,
					ready_at: now.toISOString(),
				}), // 20 min
				makeOrder({
					id: "b",
					display_no: 2,
					status: "READY",
					created_at: tenMinAgo,
					ready_at: now.toISOString(),
				}), // 10 min
			])
			.run();

		const svc = new StatsService(db);
		const stats = svc.getByPeriod("daily");
		// Average should be ~15 minutes (allow ±1 for rounding/timing)
		expect(stats.averagePrepMinutes).not.toBeNull();
		expect(stats.averagePrepMinutes!).toBeGreaterThan(14);
		expect(stats.averagePrepMinutes!).toBeLessThan(16);
		expect(stats.averageDeliverySeconds).toBeNull();
	});

	it("returns zero totalOrders for empty period", () => {
		const db = createTestDb();
		const svc = new StatsService(db);
		const stats = svc.getByPeriod("monthly");
		expect(stats.totalOrders).toBe(0);
		expect(stats.averagePrepMinutes).toBeNull();
		expect(stats.averageDeliverySeconds).toBeNull();
	});
});
