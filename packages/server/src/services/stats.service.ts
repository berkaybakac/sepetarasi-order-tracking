import { OrderStatus } from "@sepetarasi/shared";
import type { DayStats } from "@sepetarasi/shared";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { AppDatabase } from "../db/connection.js";
import { orders } from "../db/schema.js";

export class StatsService {
	constructor(private db: AppDatabase) {}

	getToday(businessDate?: string): DayStats {
		const tz = process.env.STORE_TIMEZONE || "Europe/Istanbul";
		const date = businessDate ?? new Date().toLocaleDateString("en-CA", { timeZone: tz });

		// Count by status
		const counts = this.db
			.select({
				status: orders.status,
				count: sql<number>`COUNT(*)`,
			})
			.from(orders)
			.where(eq(orders.business_date, date))
			.groupBy(orders.status)
			.all();

		const byStatus: Record<OrderStatus, number> = {
			[OrderStatus.PREPARING]: 0,
			[OrderStatus.READY]: 0,
			[OrderStatus.DELIVERED]: 0,
			[OrderStatus.CANCELLED]: 0,
		};

		let totalOrders = 0;
		for (const row of counts) {
			const status = row.status as OrderStatus;
			byStatus[status] = row.count;
			// Operational totals exclude cancelled orders.
			if (status !== OrderStatus.CANCELLED) {
				totalOrders += row.count;
			}
		}

		// Average preparation time (created_at -> ready_at) in minutes
		const avgResult = this.db
			.select({
				avgMinutes: sql<number | null>`AVG(
					(julianday(${orders.ready_at}) - julianday(${orders.created_at})) * 1440
				)`,
			})
			.from(orders)
			.where(
				and(
					eq(orders.business_date, date),
					sql`${orders.ready_at} IS NOT NULL`,
					sql`${orders.status} != ${OrderStatus.CANCELLED}`,
				),
			)
			.get();

		const averagePrepMinutes =
			avgResult?.avgMinutes != null ? Math.round(avgResult.avgMinutes * 10) / 10 : null;

		return { totalOrders, byStatus, averagePrepMinutes };
	}

	getByPeriod(period: "daily" | "weekly" | "monthly"): DayStats {
		const tz = process.env.STORE_TIMEZONE || "Europe/Istanbul";
		const toDate = new Date().toLocaleDateString("en-CA", { timeZone: tz });

		const daysBack = period === "daily" ? 0 : period === "weekly" ? 6 : 29;
		const fromDateObj = new Date();
		fromDateObj.setDate(fromDateObj.getDate() - daysBack);
		const fromDate = fromDateObj.toLocaleDateString("en-CA", { timeZone: tz });

		const dateFilter = and(gte(orders.business_date, fromDate), lte(orders.business_date, toDate));

		const counts = this.db
			.select({ status: orders.status, count: sql<number>`COUNT(*)` })
			.from(orders)
			.where(dateFilter)
			.groupBy(orders.status)
			.all();

		const byStatus: Record<OrderStatus, number> = {
			[OrderStatus.PREPARING]: 0,
			[OrderStatus.READY]: 0,
			[OrderStatus.DELIVERED]: 0,
			[OrderStatus.CANCELLED]: 0,
		};
		let totalOrders = 0;
		for (const row of counts) {
			const status = row.status as OrderStatus;
			byStatus[status] = row.count;
			// Operational totals exclude cancelled orders.
			if (status !== OrderStatus.CANCELLED) {
				totalOrders += row.count;
			}
		}

		const avgResult = this.db
			.select({
				avgMinutes: sql<number | null>`AVG(
					(julianday(${orders.ready_at}) - julianday(${orders.created_at})) * 1440
				)`,
			})
			.from(orders)
			.where(
				and(
					dateFilter,
					sql`${orders.ready_at} IS NOT NULL`,
					sql`${orders.status} != ${OrderStatus.CANCELLED}`,
				),
			)
			.get();

		const averagePrepMinutes =
			avgResult?.avgMinutes != null ? Math.round(avgResult.avgMinutes * 10) / 10 : null;

		return { totalOrders, byStatus, averagePrepMinutes };
	}
}
