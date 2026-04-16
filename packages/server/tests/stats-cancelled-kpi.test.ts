import { describe, expect, it } from "vitest";
import { orders } from "../src/db/schema.js";
import { createTestDb } from "../src/db/test-utils.js";
import { StatsService } from "../src/services/stats.service.js";

describe("StatsService cancelled-order KPI rules", () => {
	it("getToday excludes CANCELLED from totalOrders and averagePrepMinutes", () => {
		const db = createTestDb();
		const service = new StatsService(db);
		const businessDate = "2026-04-16";
		const now = new Date("2026-04-16T12:00:00.000Z");
		const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
		const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
		const current = now.toISOString();

		db.insert(orders)
			.values([
				{
					id: "ready-order",
					business_date: businessDate,
					display_no: 1,
					status: "READY",
					created_at: tenMinutesAgo,
					updated_at: current,
					ready_at: current,
				},
				{
					// READY -> CANCELLED geçmişi: ready_at dolu olabilir.
					id: "cancelled-order",
					business_date: businessDate,
					display_no: 2,
					status: "CANCELLED",
					created_at: thirtyMinutesAgo,
					updated_at: current,
					ready_at: current,
					cancelled_at: current,
				},
			])
			.run();

		const stats = service.getToday(businessDate);

		expect(stats.totalOrders).toBe(1);
		expect(stats.byStatus.CANCELLED).toBe(1);
		expect(stats.averagePrepMinutes).not.toBeNull();
		expect(stats.averagePrepMinutes!).toBeGreaterThan(9);
		expect(stats.averagePrepMinutes!).toBeLessThan(12);
	});

	it("getByPeriod also excludes CANCELLED from totalOrders and averagePrepMinutes", () => {
		const db = createTestDb();
		const service = new StatsService(db);
		const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
		const now = new Date();
		const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
		const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000).toISOString();
		const current = now.toISOString();

		db.insert(orders)
			.values([
				{
					id: "preparing-order",
					business_date: today,
					display_no: 1,
					status: "PREPARING",
					created_at: current,
					updated_at: current,
				},
				{
					id: "ready-order",
					business_date: today,
					display_no: 2,
					status: "READY",
					created_at: fiveMinutesAgo,
					updated_at: current,
					ready_at: current,
				},
				{
					id: "cancelled-order",
					business_date: today,
					display_no: 3,
					status: "CANCELLED",
					created_at: twentyMinutesAgo,
					updated_at: current,
					ready_at: current,
					cancelled_at: current,
				},
			])
			.run();

		const stats = service.getByPeriod("daily");

		expect(stats.totalOrders).toBe(2);
		expect(stats.byStatus.CANCELLED).toBe(1);
		expect(stats.averagePrepMinutes).not.toBeNull();
		expect(stats.averagePrepMinutes!).toBeGreaterThan(4);
		expect(stats.averagePrepMinutes!).toBeLessThan(7);
	});
});
