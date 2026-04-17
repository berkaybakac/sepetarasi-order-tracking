import {
	API_ROUTES,
	SETTING_KEYS,
	WS_CHANNELS,
	WS_EVENTS,
	isDisplaySettingKey,
} from "@sepetarasi/shared";
import type { FastifyInstance } from "fastify";
import {
	isEditableSettingKey,
	isPublicSettingKey,
	toPublicSettings,
	validateSettingValue,
} from "../config/settings.js";
import type { AppDatabase } from "../db/connection.js";
import { appSettings } from "../db/schema.js";
import { requireAdmin } from "../utils/auth-middleware.js";
import type { Broadcaster } from "../ws/broadcaster.js";

function getBroadcastChannelsForSetting(key: string): string[] {
	const channels = new Set<string>();

	if (key === SETTING_KEYS.DELIVERY_TARGET_MINUTES || key === SETTING_KEYS.NOTE_PRESETS) {
		channels.add(WS_CHANNELS.ORDERS);
	}
	if (isDisplaySettingKey(key)) {
		channels.add(WS_CHANNELS.DISPLAY);
	}

	return [...channels];
}

export function registerSettingsRoutes(
	app: FastifyInstance,
	db: AppDatabase,
	broadcaster: Broadcaster,
) {
	const PRIVATE_ADMIN_KEYS = new Set<string>([SETTING_KEYS.ADMIN_PASSWORD_HASH]);

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
			if (PRIVATE_ADMIN_KEYS.has(row.key)) continue;
			settings[row.key] = row.value;
		}
		return { ok: true, data: settings };
	});

	// PATCH /api/v1/settings/bulk - ayarlari atomik sekilde toplu guncelle
	app.patch<{ Body: { settings: Record<string, string> } }>(
		API_ROUTES.V1.SETTINGS_BULK,
		{
			preHandler: requireAdmin,
			schema: {
				body: {
					type: "object",
					properties: {
						settings: {
							type: "object",
							minProperties: 1,
							additionalProperties: { type: "string" },
						},
					},
					required: ["settings"],
				},
			},
		},
		async (request, reply) => {
			const entries = Object.entries(request.body.settings);

			for (const [key, value] of entries) {
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
						error: { code: "INVALID_SETTING_VALUE", message: `${key}: ${validationError}` },
					});
				}
			}

			const now = new Date().toISOString();
			db.transaction((tx) => {
				for (const [key, value] of entries) {
					tx.insert(appSettings)
						.values({ key, value, updated_at: now })
						.onConflictDoUpdate({ target: appSettings.key, set: { value, updated_at: now } })
						.run();
				}
			});

			const changedKeys = entries.map(([key]) => key).sort();
			request.log.info(
				{
					event: "settings.bulk_updated",
					changedKeys,
					changedCount: changedKeys.length,
					requestId: request.id,
					ip: request.ip,
				},
				"Bulk settings updated",
			);

			const presetEntry = entries.find(([key]) => key === SETTING_KEYS.NOTE_PRESETS);
			if (presetEntry) {
				let presetCount: number | null = null;
				try {
					const parsed = JSON.parse(presetEntry[1]);
					if (Array.isArray(parsed)) presetCount = parsed.length;
				} catch {
					// validation already passed; defensive
				}
				request.log.info(
					{
						event: "note_presets.updated",
						presetCount,
						requestId: request.id,
						ip: request.ip,
					},
					"Note presets updated",
				);
			}

			for (const key of changedKeys) {
				if (!isPublicSettingKey(key)) continue;
				const channels = getBroadcastChannelsForSetting(key);
				if (channels.length === 0) continue;
				broadcaster.broadcast(channels, WS_EVENTS.SETTINGS_UPDATED, { key });
			}

			return { ok: true, data: null };
		},
	);

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

			request.log.info(
				{
					event: "settings.updated",
					key,
					requestId: request.id,
					ip: request.ip,
				},
				"Setting updated",
			);

			if (isPublicSettingKey(key)) {
				const channels = getBroadcastChannelsForSetting(key);
				if (channels.length > 0) {
					broadcaster.broadcast(channels, WS_EVENTS.SETTINGS_UPDATED, { key });
				}
			}

			return { ok: true, data: null };
		},
	);
}
