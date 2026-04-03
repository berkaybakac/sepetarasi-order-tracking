import { eq, sql, and } from "drizzle-orm";
import { OrderStatus } from "@sepetarasi/shared";
import type { DayStats } from "@sepetarasi/shared";
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
			byStatus[row.status as OrderStatus] = row.count;
			totalOrders += row.count;
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
				),
			)
			.get();

		const averagePrepMinutes =
			avgResult?.avgMinutes != null ? Math.round(avgResult.avgMinutes * 10) / 10 : null;

		return { totalOrders, byStatus, averagePrepMinutes };
	}
}
