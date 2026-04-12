import { API_ROUTES } from "@sepetarasi/shared";
import type { FastifyInstance } from "fastify";
import {
	isEditableSettingKey,
	toPublicSettings,
	validateSettingValue,
} from "../config/settings.js";
import type { AppDatabase } from "../db/connection.js";
import { appSettings } from "../db/schema.js";
import { requireAdmin } from "../utils/auth-middleware.js";

export function registerSettingsRoutes(app: FastifyInstance, db: AppDatabase) {
	// GET /api/v1/settings/public - authentication gerektirmeyen, ekrana acik ayarlar
	app.get(API_ROUTES.V1.SETTINGS_PUBLIC, async () => {
		const rows = db.select().from(appSettings).all();
		return { ok: true, data: toPublicSettings(rows) };
	});

	// GET /api/v1/settings - readonly, tum key-value ciftlerini doner
	app.get(API_ROUTES.V1.SETTINGS, { preHandler: requireAdmin }, async () => {
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
			preHandler: requireAdmin,
			schema: {
				params: { type: "object", properties: { key: { type: "string" } }, required: ["key"] },
				body: { type: "object", properties: { value: { type: "string" } }, required: ["value"] },
			},
		},
		async (request, reply) => {
			const { key } = request.params;
			const { value } = request.body;

			if (!isEditableSettingKey(key)) {
				return reply.code(400).send({
					ok: false,
					error: {
						code: "INVALID_SETTING_KEY",
						message: `Unknown or non-editable setting key: ${key}`,
					},
				});
			}

			const validationError = validateSettingValue(key, value);
			if (validationError) {
				return reply.code(400).send({
					ok: false,
					error: { code: "INVALID_SETTING_VALUE", message: validationError },
				});
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
