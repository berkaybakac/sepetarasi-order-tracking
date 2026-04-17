import { API_ROUTES, SETTING_KEYS } from "@sepetarasi/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { AppDatabase } from "../../db/connection.js";
import { appSettings } from "../../db/schema.js";
import type { MusicPlayerService } from "../../services/music-player.service.js";
import { requireAdmin } from "../../utils/auth-middleware.js";

function upsertSetting(db: AppDatabase, key: string, value: string): void {
	db.insert(appSettings)
		.values({
			key,
			value,
			updated_at: new Date().toISOString(),
		})
		.onConflictDoUpdate({
			target: appSettings.key,
			set: { value, updated_at: new Date().toISOString() },
		})
		.run();
}

function getSettingValue(db: AppDatabase, key: string): string | null {
	const row = db.select().from(appSettings).where(eq(appSettings.key, key)).get();
	return row?.value ?? null;
}

export function registerMusicControlRoutes(
	app: FastifyInstance,
	db: AppDatabase,
	musicPlayer: MusicPlayerService | null,
): void {
	app.get(API_ROUTES.V1.MUSIC.STATUS, { preHandler: requireAdmin }, async () => {
		const status =
			musicPlayer?.getStatus() ??
			(() => {
				const volume = Number(getSettingValue(db, SETTING_KEYS.MUSIC_VOLUME) ?? 60);
				const enabled = getSettingValue(db, SETTING_KEYS.MUSIC_ENABLED) === "1";
				const loop = getSettingValue(db, SETTING_KEYS.MUSIC_LOOP_ENABLED);
				const shuffle = getSettingValue(db, SETTING_KEYS.MUSIC_SHUFFLE_ENABLED);
				return {
					isPlaying: false,
					isPaused: false,
					isDucked: false,
					currentTrackId: null,
					currentTrackName: null,
					volume: Number.isFinite(volume) ? Math.max(0, Math.min(100, volume)) : 60,
					enabled,
					loop: loop === null ? true : loop === "1",
					shuffle: shuffle === "1",
				};
			})();
		return { ok: true, data: status };
	});

	app.post(API_ROUTES.V1.MUSIC.PLAY, { preHandler: requireAdmin }, async () => {
		musicPlayer?.play();
		return { ok: true, data: null };
	});

	app.post(API_ROUTES.V1.MUSIC.PAUSE, { preHandler: requireAdmin }, async () => {
		musicPlayer?.pause();
		return { ok: true, data: null };
	});

	app.post(API_ROUTES.V1.MUSIC.SKIP, { preHandler: requireAdmin }, async () => {
		musicPlayer?.skip();
		return { ok: true, data: null };
	});

	app.post(API_ROUTES.V1.MUSIC.PREVIOUS, { preHandler: requireAdmin }, async () => {
		musicPlayer?.previous();
		return { ok: true, data: null };
	});

	app.patch(API_ROUTES.V1.MUSIC.VOLUME, { preHandler: requireAdmin }, async (request, reply) => {
		const body = request.body as { volume?: unknown };
		const volume = Number(body?.volume);
		if (!Number.isInteger(volume) || volume < 0 || volume > 100) {
			return reply.status(400).send({
				ok: false,
				error: { code: "VALIDATION_ERROR", message: "volume must be an integer between 0 and 100" },
			});
		}

		upsertSetting(db, SETTING_KEYS.MUSIC_VOLUME, String(volume));
		musicPlayer?.setVolume(volume);
		return { ok: true, data: null };
	});

	app.patch(API_ROUTES.V1.MUSIC.ENABLED, { preHandler: requireAdmin }, async (request, reply) => {
		const body = request.body as { enabled?: unknown };
		if (typeof body.enabled !== "boolean") {
			return reply.status(400).send({
				ok: false,
				error: { code: "VALIDATION_ERROR", message: "enabled must be a boolean" },
			});
		}

		upsertSetting(db, SETTING_KEYS.MUSIC_ENABLED, body.enabled ? "1" : "0");
		musicPlayer?.setEnabled(body.enabled);
		return { ok: true, data: null };
	});

	app.patch(API_ROUTES.V1.MUSIC.MODE, { preHandler: requireAdmin }, async (request, reply) => {
		const body = request.body as { loop?: unknown; shuffle?: unknown };
		const hasLoop = typeof body.loop === "boolean";
		const hasShuffle = typeof body.shuffle === "boolean";

		if (!hasLoop && !hasShuffle) {
			return reply.status(400).send({
				ok: false,
				error: { code: "VALIDATION_ERROR", message: "loop or shuffle must be provided as boolean" },
			});
		}

		if (hasLoop) {
			upsertSetting(db, SETTING_KEYS.MUSIC_LOOP_ENABLED, body.loop ? "1" : "0");
			musicPlayer?.setLoop(body.loop as boolean);
		}
		if (hasShuffle) {
			upsertSetting(db, SETTING_KEYS.MUSIC_SHUFFLE_ENABLED, body.shuffle ? "1" : "0");
			musicPlayer?.setShuffle(body.shuffle as boolean);
		}

		return { ok: true, data: null };
	});
}
