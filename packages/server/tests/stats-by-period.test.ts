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

	it("returns null averagePrepMinutes when no orders have ready_at", () => {
		const db = createTestDb();
		db.insert(orders)
			.values([makeOrder({ id: "a", display_no: 1, status: "PREPARING" })])
			.run();

		const svc = new StatsService(db);
		const stats = svc.getByPeriod("daily");
		expect(stats.averagePrepMinutes).toBeNull();
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
	});

	it("returns zero totalOrders for empty period", () => {
		const db = createTestDb();
		const svc = new StatsService(db);
		const stats = svc.getByPeriod("monthly");
		expect(stats.totalOrders).toBe(0);
		expect(stats.averagePrepMinutes).toBeNull();
	});
});
