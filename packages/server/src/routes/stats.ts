import type { FastifyInstance } from "fastify";
import { StatsService } from "../services/stats.service.js";
import type { AppDatabase } from "../db/connection.js";

export function registerStatsRoutes(app: FastifyInstance, db: AppDatabase) {
	const statsService = new StatsService(db);

	// GET /api/v1/stats/today
	app.get<{ Querystring: { business_date?: string } }>(
		"/api/v1/stats/today",
		async (request) => {
			const stats = statsService.getToday(request.query.business_date || undefined);
			return { ok: true, data: stats };
		},
	);
}
