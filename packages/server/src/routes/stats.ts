import type { FastifyInstance } from "fastify";
import type { AppDatabase } from "../db/connection.js";
import { StatsService } from "../services/stats.service.js";

const VALID_PERIODS = ["daily", "weekly", "monthly"] as const;
type Period = (typeof VALID_PERIODS)[number];

export function registerStatsRoutes(app: FastifyInstance, db: AppDatabase) {
	const statsService = new StatsService(db);

	// GET /api/v1/stats/today
	app.get<{ Querystring: { business_date?: string } }>("/api/v1/stats/today", async (request) => {
		const stats = statsService.getToday(request.query.business_date || undefined);
		return { ok: true, data: stats };
	});

	// GET /api/v1/stats?period=daily|weekly|monthly
	app.get<{ Querystring: { period?: string } }>("/api/v1/stats", async (request, reply) => {
		const period = (request.query.period || "daily") as Period;
		if (!VALID_PERIODS.includes(period)) {
			return reply.status(400).send({
				ok: false,
				error: { code: "INVALID_PERIOD", message: "period must be daily, weekly, or monthly" },
			});
		}
		const stats = statsService.getByPeriod(period);
		return { ok: true, data: stats };
	});
}
