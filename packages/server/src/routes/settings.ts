import type { FastifyInstance } from "fastify";
import type { AppDatabase } from "../db/connection.js";
import { appSettings } from "../db/schema.js";

export function registerSettingsRoutes(app: FastifyInstance, db: AppDatabase) {
	// GET /api/v1/settings - readonly, tum key-value ciftlerini doner
	app.get("/api/v1/settings", async () => {
		const rows = db.select().from(appSettings).all();
		const settings: Record<string, string> = {};
		for (const row of rows) {
			settings[row.key] = row.value;
		}
		return { ok: true, data: settings };
	});
}
