import { API_ROUTES } from "@sepetarasi/shared";
import type { FastifyInstance } from "fastify";
import type { AppDatabase } from "../db/connection.js";
import { appSettings } from "../db/schema.js";

export function registerSettingsRoutes(app: FastifyInstance, db: AppDatabase) {
	// GET /api/v1/settings - readonly, tum key-value ciftlerini doner
	app.get(API_ROUTES.V1.SETTINGS, async () => {
		const rows = db.select().from(appSettings).all();
		const settings: Record<string, string> = {};
		for (const row of rows) {
			settings[row.key] = row.value;
		}
		return { ok: true, data: settings };
	});

	// PATCH /api/v1/settings/:key - bir ayari guncelle (veya ekle)
	app.patch<{ Params: { key: string }; Body: { value: string } }>(
		API_ROUTES.V1.SETTING_BY_KEY(":key"),
		{
			schema: {
				params: { type: "object", properties: { key: { type: "string" } }, required: ["key"] },
				body: { type: "object", properties: { value: { type: "string" } }, required: ["value"] },
			},
		},
		async (request, reply) => {
			const { key } = request.params;
			const { value } = request.body;
			if (key === "audio_volume") {
				const num = Number(value);
				if (Number.isNaN(num) || num < 0 || num > 100) {
					return reply.code(400).send({
						ok: false,
						error: { code: "INVALID_SETTING_VALUE", message: "audio_volume must be 0-100" },
					});
				}
			}
			const now = new Date().toISOString();
			db.insert(appSettings)
				.values({ key, value, updated_at: now })
				.onConflictDoUpdate({ target: appSettings.key, set: { value, updated_at: now } })
				.run();
			return { ok: true, data: null };
		},
	);
}
