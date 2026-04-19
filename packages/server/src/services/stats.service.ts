import {
	DELIVERY_TARGET_DEFAULT_MINUTES,
	ORDER_TYPES,
	OrderStatus,
	SETTING_KEYS,
} from "@sepetarasi/shared";
import type {
	DayStats,
	DeliveryAnalyticsByOrderType,
	DeliveryAnalyticsDistributionBucket,
	DeliveryAnalyticsGranularity,
	DeliveryAnalyticsResult,
	DeliveryAnalyticsTimeSeriesPoint,
	OrderType,
} from "@sepetarasi/shared";
import { type SQL, and, eq, gte, lte, sql } from "drizzle-orm";
import type { AppDatabase } from "../db/connection.js";
import { appSettings, orders } from "../db/schema.js";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class InvalidDeliveryAnalyticsRangeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "InvalidDeliveryAnalyticsRangeError";
	}
}

export function isValidIsoCalendarDate(value: string): boolean {
	if (!ISO_DATE_RE.test(value)) return false;

	const [yearStr, monthStr, dayStr] = value.split("-");
	const year = Number(yearStr);
	const month = Number(monthStr);
	const day = Number(dayStr);

	if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
		return false;
	}

	const date = new Date(Date.UTC(year, month - 1, day));
	return (
		date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
	);
}

function assertIsoCalendarDate(value: string, label: "from" | "to") {
	if (!isValidIsoCalendarDate(value)) {
		throw new InvalidDeliveryAnalyticsRangeError(
			`${label} must be a real calendar date in YYYY-MM-DD`,
		);
	}
}

function daysBetweenInclusive(fromIso: string, toIso: string): number {
	const from = new Date(`${fromIso}T00:00:00Z`).getTime();
	const to = new Date(`${toIso}T00:00:00Z`).getTime();
	return Math.round((to - from) / 86_400_000) + 1;
}

function shiftIsoDate(iso: string, deltaDays: number): string {
	const d = new Date(`${iso}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + deltaDays);
	return d.toISOString().slice(0, 10);
}

function round1(n: number): number {
	return Math.round(n * 10) / 10;
}

function resolveStoreTimeZone(): string {
	const candidate = process.env.STORE_TIMEZONE;
	if (!candidate || candidate === "undefined" || candidate === "null") {
		return "Europe/Istanbul";
	}

	try {
		new Intl.DateTimeFormat("en-CA", { timeZone: candidate }).format(new Date());
		return candidate;
	} catch {
		return "Europe/Istanbul";
	}
}

const STORE_TIMEZONE = resolveStoreTimeZone();

function createHourBucketFormatter(timeZone: string) {
	const formatter = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		hourCycle: "h23",
	});

	return (dateStr: string) => {
		const parts = formatter.formatToParts(new Date(dateStr));
		const year = parts.find((part) => part.type === "year")?.value;
		const month = parts.find((part) => part.type === "month")?.value;
		const day = parts.find((part) => part.type === "day")?.value;
		const hour = parts.find((part) => part.type === "hour")?.value;

		if (!year || !month || !day || !hour) {
			throw new Error(`Could not format hour bucket for ${dateStr}`);
		}

		return `${year}-${month}-${day}T${hour}:00`;
	};
}

const toHourBucket = createHourBucketFormatter(STORE_TIMEZONE);

type DeliveryTimeSeriesRow = {
	createdAt: string;
	deliveredAt: string;
};

export class StatsService {
	constructor(private db: AppDatabase) {}

	getToday(businessDate?: string): DayStats {
		const date =
			businessDate ?? new Date().toLocaleDateString("en-CA", { timeZone: STORE_TIMEZONE });
		return this.buildDayStats(eq(orders.business_date, date));
	}

	getByPeriod(period: "daily" | "weekly" | "monthly"): DayStats {
		const toDate = new Date().toLocaleDateString("en-CA", { timeZone: STORE_TIMEZONE });

		const daysBack = period === "daily" ? 0 : period === "weekly" ? 6 : 29;
		const fromDateObj = new Date();
		fromDateObj.setDate(fromDateObj.getDate() - daysBack);
		const fromDate = fromDateObj.toLocaleDateString("en-CA", { timeZone: STORE_TIMEZONE });

		const dateFilter =
			and(gte(orders.business_date, fromDate), lte(orders.business_date, toDate)) ?? sql`1 = 1`;
		return this.buildDayStats(dateFilter);
	}

	private buildDayStats(dateFilter: SQL<unknown>): DayStats {
		const counts = this.db
			.select({
				status: orders.status,
				count: sql<number>`COUNT(*)`,
			})
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
					dateFilter,
					sql`${orders.ready_at} IS NOT NULL`,
					sql`${orders.status} != ${OrderStatus.CANCELLED}`,
				),
			)
			.get();

		const averagePrepMinutes =
			avgResult?.avgMinutes != null ? Math.round(avgResult.avgMinutes * 10) / 10 : null;

		const deliveryAvgResult = this.db
			.select({
				avgSeconds: sql<number | null>`AVG(
					(julianday(${orders.delivered_at}) - julianday(${orders.created_at})) * 86400
				)`,
			})
			.from(orders)
			.where(and(dateFilter, sql`${orders.delivered_at} IS NOT NULL`))
			.get();

		const averageDeliverySeconds =
			deliveryAvgResult?.avgSeconds != null
				? Math.max(0, Math.round(deliveryAvgResult.avgSeconds))
				: null;

		return { totalOrders, byStatus, averagePrepMinutes, averageDeliverySeconds };
	}

	private getDeliveryTargetMinutes(): number {
		const row = this.db
			.select({ value: appSettings.value })
			.from(appSettings)
			.where(eq(appSettings.key, SETTING_KEYS.DELIVERY_TARGET_MINUTES))
			.get();
		const parsed = row?.value != null ? Number(row.value) : Number.NaN;
		if (Number.isInteger(parsed) && parsed > 0) return parsed;
		return DELIVERY_TARGET_DEFAULT_MINUTES;
	}

	private computeAverageMinutes(
		fromDate: string,
		toDate: string,
	): {
		averageMinutes: number;
		deliveredCount: number;
	} {
		const res = this.db
			.select({
				avgMinutes: sql<number | null>`AVG(
					(julianday(${orders.delivered_at}) - julianday(${orders.created_at})) * 1440
				)`,
				count: sql<number>`COUNT(*)`,
			})
			.from(orders)
			.where(
				and(
					gte(orders.business_date, fromDate),
					lte(orders.business_date, toDate),
					eq(orders.status, OrderStatus.DELIVERED),
					sql`${orders.delivered_at} IS NOT NULL`,
				),
			)
			.get();

		const avg = res?.avgMinutes != null ? Math.max(0, res.avgMinutes) : 0;
		return {
			averageMinutes: round1(avg),
			deliveredCount: res?.count ?? 0,
		};
	}

	private computeTimeSeries(
		fromDate: string,
		toDate: string,
		granularity: DeliveryAnalyticsGranularity,
	): DeliveryAnalyticsTimeSeriesPoint[] {
		if (granularity === "day") {
			const rows = this.db
				.select({
					bucket: sql<string>`${orders.business_date}`,
					avgMinutes: sql<number | null>`AVG(
						(julianday(${orders.delivered_at}) - julianday(${orders.created_at})) * 1440
					)`,
					count: sql<number>`COUNT(*)`,
				})
				.from(orders)
				.where(
					and(
						gte(orders.business_date, fromDate),
						lte(orders.business_date, toDate),
						eq(orders.status, OrderStatus.DELIVERED),
						sql`${orders.delivered_at} IS NOT NULL`,
					),
				)
				.groupBy(orders.business_date)
				.orderBy(orders.business_date)
				.all();

			return rows.map((row) => ({
				bucket: row.bucket,
				averageDeliveryMinutes: row.avgMinutes != null ? round1(Math.max(0, row.avgMinutes)) : 0,
				deliveredCount: row.count,
			}));
		}

		const rows = this.db
			.select({
				createdAt: orders.created_at,
				deliveredAt: orders.delivered_at,
			})
			.from(orders)
			.where(
				and(
					gte(orders.business_date, fromDate),
					lte(orders.business_date, toDate),
					eq(orders.status, OrderStatus.DELIVERED),
					sql`${orders.delivered_at} IS NOT NULL`,
				),
			)
			.all() as DeliveryTimeSeriesRow[];

		const buckets = new Map<string, { totalMinutes: number; count: number }>();
		for (const row of rows) {
			const deliveredAtMs = Date.parse(row.deliveredAt);
			const createdAtMs = Date.parse(row.createdAt);
			const durationMinutes = (deliveredAtMs - createdAtMs) / 60000;

			if (!Number.isFinite(durationMinutes)) continue;

			const bucket = toHourBucket(row.createdAt);
			const current = buckets.get(bucket) ?? { totalMinutes: 0, count: 0 };
			current.totalMinutes += Math.max(0, durationMinutes);
			current.count += 1;
			buckets.set(bucket, current);
		}

		return [...buckets.entries()]
			.sort(([leftBucket], [rightBucket]) => leftBucket.localeCompare(rightBucket))
			.map(([bucket, stats]) => ({
				bucket,
				averageDeliveryMinutes: round1(stats.totalMinutes / stats.count),
				deliveredCount: stats.count,
			}));
	}

	private computeDistribution(
		fromDate: string,
		toDate: string,
	): DeliveryAnalyticsDistributionBucket[] {
		const rows = this.db
			.select({
				minutes: sql<number>`(julianday(${orders.delivered_at}) - julianday(${orders.created_at})) * 1440`,
			})
			.from(orders)
			.where(
				and(
					gte(orders.business_date, fromDate),
					lte(orders.business_date, toDate),
					eq(orders.status, OrderStatus.DELIVERED),
					sql`${orders.delivered_at} IS NOT NULL`,
				),
			)
			.all();

		const buckets: DeliveryAnalyticsDistributionBucket[] = [
			{ bucket: "0-5dk", count: 0 },
			{ bucket: "5-10dk", count: 0 },
			{ bucket: "10-15dk", count: 0 },
			{ bucket: "15-20dk", count: 0 },
			{ bucket: "20+dk", count: 0 },
		];
		for (const row of rows) {
			const m = row.minutes ?? 0;
			if (m < 5) buckets[0].count++;
			else if (m < 10) buckets[1].count++;
			else if (m < 15) buckets[2].count++;
			else if (m < 20) buckets[3].count++;
			else buckets[4].count++;
		}
		return buckets;
	}

	private computeByOrderType(fromDate: string, toDate: string): DeliveryAnalyticsByOrderType[] {
		const rows = this.db
			.select({
				orderType: orders.order_type,
				avgMinutes: sql<number | null>`AVG(
					(julianday(${orders.delivered_at}) - julianday(${orders.created_at})) * 1440
				)`,
				count: sql<number>`COUNT(*)`,
			})
			.from(orders)
			.where(
				and(
					gte(orders.business_date, fromDate),
					lte(orders.business_date, toDate),
					eq(orders.status, OrderStatus.DELIVERED),
					sql`${orders.delivered_at} IS NOT NULL`,
					sql`${orders.order_type} IS NOT NULL`,
				),
			)
			.groupBy(orders.order_type)
			.all();

		const byType = new Map<OrderType, DeliveryAnalyticsByOrderType>();
		for (const row of rows) {
			const t = row.orderType as OrderType | null;
			if (t == null) continue;
			if (!ORDER_TYPES.includes(t)) continue;
			byType.set(t, {
				orderType: t,
				averageDeliveryMinutes: row.avgMinutes != null ? round1(Math.max(0, row.avgMinutes)) : 0,
				deliveredCount: row.count,
			});
		}
		return ORDER_TYPES.filter((t) => byType.has(t)).map(
			(t) => byType.get(t) as DeliveryAnalyticsByOrderType,
		);
	}

	private computeOnTarget(
		fromDate: string,
		toDate: string,
		targetMinutes: number,
	): { onTargetCount: number; onTargetRate: number; totalDelivered: number } {
		const res = this.db
			.select({
				total: sql<number>`COUNT(*)`,
				onTarget: sql<number>`SUM(CASE WHEN
					((julianday(${orders.delivered_at}) - julianday(${orders.created_at})) * 1440) <= ${targetMinutes}
					THEN 1 ELSE 0 END)`,
			})
			.from(orders)
			.where(
				and(
					gte(orders.business_date, fromDate),
					lte(orders.business_date, toDate),
					eq(orders.status, OrderStatus.DELIVERED),
					sql`${orders.delivered_at} IS NOT NULL`,
				),
			)
			.get();

		const total = res?.total ?? 0;
		const onTarget = res?.onTarget ?? 0;
		const rate = total > 0 ? Math.round((onTarget / total) * 1000) / 10 : 0;
		return { onTargetCount: onTarget, onTargetRate: rate, totalDelivered: total };
	}

	private static readonly MAX_RANGE_DAYS = 366;

	getDeliveryAnalytics(from: string, to: string): DeliveryAnalyticsResult {
		assertIsoCalendarDate(from, "from");
		assertIsoCalendarDate(to, "to");
		if (from > to) {
			throw new InvalidDeliveryAnalyticsRangeError("from must be <= to");
		}

		const targetMinutes = this.getDeliveryTargetMinutes();
		const rangeDays = daysBetweenInclusive(from, to);
		if (rangeDays > StatsService.MAX_RANGE_DAYS) {
			throw new InvalidDeliveryAnalyticsRangeError(
				`date range must not exceed ${StatsService.MAX_RANGE_DAYS} days`,
			);
		}
		const granularity: DeliveryAnalyticsGranularity = rangeDays <= 2 ? "hour" : "day";

		const previousTo = shiftIsoDate(from, -1);
		const previousFrom = shiftIsoDate(previousTo, -(rangeDays - 1));

		const current = this.computeAverageMinutes(from, to);
		const previous = this.computeAverageMinutes(previousFrom, previousTo);
		const onTarget = this.computeOnTarget(from, to, targetMinutes);
		const timeSeriesPoints = this.computeTimeSeries(from, to, granularity);
		const distribution = this.computeDistribution(from, to);
		const byOrderType = this.computeByOrderType(from, to);

		const trendPercent =
			previous.averageMinutes > 0
				? round1(
						((current.averageMinutes - previous.averageMinutes) / previous.averageMinutes) * 100,
					)
				: 0;

		return {
			range: { from, to },
			summary: {
				averageDeliveryMinutes: current.averageMinutes,
				totalDelivered: onTarget.totalDelivered,
				targetMinutes,
				previousPeriodAvgMinutes: previous.averageMinutes,
				trendPercent,
				onTargetRate: onTarget.onTargetRate,
				onTargetCount: onTarget.onTargetCount,
			},
			timeSeries: {
				granularity,
				points: timeSeriesPoints,
			},
			distribution,
			byOrderType,
		};
	}
}
