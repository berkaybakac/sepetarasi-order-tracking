import { API_ROUTES, STAT_PERIODS } from "@sepetarasi/shared";
import type { StatPeriod } from "@sepetarasi/shared";
import type { FastifyInstance } from "fastify";
import type { AppDatabase } from "../db/connection.js";
import { InvalidDeliveryAnalyticsRangeError, StatsService } from "../services/stats.service.js";
import { requireAdmin } from "../utils/auth-middleware.js";

export function registerStatsRoutes(app: FastifyInstance, db: AppDatabase) {
	const statsService = new StatsService(db);

	// GET /api/v1/stats/today
	app.get<{ Querystring: { business_date?: string } }>(
		API_ROUTES.V1.STATS_TODAY,
		{ preHandler: requireAdmin },
		async (request) => {
			const stats = statsService.getToday(request.query.business_date || undefined);
			return { ok: true, data: stats };
		},
	);

	// GET /api/v1/stats?period=daily|weekly|monthly
	app.get<{ Querystring: { period?: string } }>(
		API_ROUTES.V1.STATS,
		{ preHandler: requireAdmin },
		async (request, reply) => {
			const period = (request.query.period || "daily") as StatPeriod;
			if (!STAT_PERIODS.includes(period)) {
				return reply.status(400).send({
					ok: false,
					error: { code: "INVALID_PERIOD", message: "period must be daily, weekly, or monthly" },
				});
			}
			const stats = statsService.getByPeriod(period);
			return { ok: true, data: stats };
		},
	);

	app.get<{ Querystring: { from?: string; to?: string } }>(
		API_ROUTES.V1.STATS_DELIVERY_ANALYTICS,
		{ preHandler: requireAdmin },
		async (request, reply) => {
			const { from, to } = request.query;
			if (!from || !to) {
				return reply.status(400).send({
					ok: false,
					error: {
						code: "INVALID_RANGE",
						message: "from and to must be provided as YYYY-MM-DD",
					},
				});
			}

			try {
				const analytics = statsService.getDeliveryAnalytics(from, to);
				return { ok: true, data: analytics };
			} catch (error) {
				if (error instanceof InvalidDeliveryAnalyticsRangeError) {
					return reply.status(400).send({
						ok: false,
						error: { code: "INVALID_RANGE", message: error.message },
					});
				}
				throw error;
			}
		},
	);
}
