import { randomUUID } from "node:crypto";
import { createWriteStream, statfsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { SETTING_KEYS } from "@sepetarasi/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { AppDatabase } from "../db/connection.js";
import { appSettings, musicTracks } from "../db/schema.js";
import type { MusicPlayerService } from "../services/music-player.service.js";
import { requireAdmin } from "../utils/auth-middleware.js";

const ACCEPTED_MIME_TYPES = new Set(["audio/mpeg", "audio/mp3", "audio/x-mpeg"]);
const MIN_FREE_DISK_MB = 100;

export function registerMusicRoutes(
	app: FastifyInstance,
	db: AppDatabase,
	musicPath: string,
	musicPlayer: MusicPlayerService | null,
): void {
	// GET /api/v1/music/disk — disk usage info
	app.get("/api/v1/music/disk", { preHandler: requireAdmin }, async () => {
		try {
			const stats = statfsSync(musicPath);
			const totalBytes = stats.bsize * stats.blocks;
			const freeBytes = stats.bsize * stats.bfree;
			const usedBytes = totalBytes - freeBytes;
			return { ok: true, data: { totalBytes, freeBytes, usedBytes } };
		} catch {
			return { ok: true, data: null };
		}
	});

	// GET /api/v1/music/tracks — list all tracks
	app.get("/api/v1/music/tracks", { preHandler: requireAdmin }, async () => {
		const tracks = db
			.select({
				id: musicTracks.id,
				filename: musicTracks.filename,
				display_name: musicTracks.display_name,
				file_size: musicTracks.file_size,
				duration_seconds: musicTracks.duration_seconds,
				sort_order: musicTracks.sort_order,
				uploaded_at: musicTracks.uploaded_at,
			})
			.from(musicTracks)
			.orderBy(musicTracks.sort_order, musicTracks.uploaded_at)
			.all();
		return { ok: true, data: tracks };
	});

	// GET /api/v1/music/status — player status
	app.get("/api/v1/music/status", { preHandler: requireAdmin }, async () => {
		const status = musicPlayer?.getStatus() ?? {
			isPlaying: false,
			isPaused: false,
			isDucked: false,
			currentTrackId: null,
			currentTrackName: null,
			volume: 60,
			enabled: false,
		};
		return { ok: true, data: status };
	});

	// POST /api/v1/music/tracks — upload a track
	app.post("/api/v1/music/tracks", { preHandler: requireAdmin }, async (request, reply) => {
		// Disable request timeout for large uploads
		request.raw.setTimeout(0);

		// Check disk space before accepting
		try {
			const stats = statfsSync(musicPath);
			const freeMb = (stats.bsize * stats.bfree) / 1024 / 1024;
			if (freeMb < MIN_FREE_DISK_MB) {
				return reply.status(507).send({
					ok: false,
					error: {
						code: "INSUFFICIENT_STORAGE",
						message: `Yetersiz disk alanı (${Math.round(freeMb)} MB kaldı)`,
					},
				});
			}
		} catch (_err) {
			// If statfs fails (e.g., in tests), proceed
		}

		const data = await (
			request as unknown as {
				file: () => Promise<{ filename: string; mimetype: string; file: NodeJS.ReadableStream }>;
			}
		).file();

		if (!ACCEPTED_MIME_TYPES.has(data.mimetype) && !data.filename.toLowerCase().endsWith(".mp3")) {
			data.file.resume(); // drain so the connection isn't left hanging
			request.log.warn(
				{ event: "music.upload.rejected", filename: data.filename, mimetype: data.mimetype },
				"Music upload rejected: unsupported format",
			);
			return reply.status(400).send({
				ok: false,
				error: { code: "INVALID_FORMAT", message: "Sadece MP3 dosyaları kabul edilmektedir" },
			});
		}

		const id = randomUUID();
		const targetPath = join(musicPath, `${id}.mp3`);
		const writeStream = createWriteStream(targetPath);

		let fileSize = 0;

		try {
			// Stream directly to disk — no RAM buffer
			const readable = data.file as NodeJS.ReadableStream;
			readable.on("data", (chunk: Buffer) => {
				fileSize += chunk.length;
			});
			await pipeline(readable, writeStream);
		} catch (err) {
			await unlink(targetPath).catch(() => undefined);
			request.log.error(
				{
					event: "music.upload.failed",
					filename: data.filename,
					targetPath,
					error: err instanceof Error ? err.message : String(err),
				},
				"Music file upload failed during stream write",
			);
			return reply.status(500).send({
				ok: false,
				error: { code: "UPLOAD_FAILED", message: "Dosya kaydedilemedi" },
			});
		}

		const displayName =
			data.filename
				.replace(/\.mp3$/i, "")
				.replace(/_/g, " ")
				.trim() || "Parça";
		const maxSortOrder =
			db
				.select({ sort_order: musicTracks.sort_order })
				.from(musicTracks)
				.orderBy(musicTracks.sort_order)
				.all()
				.at(-1)?.sort_order ?? -1;

		const newTrack = {
			id,
			filename: data.filename,
			display_name: displayName,
			file_path: targetPath,
			file_size: fileSize,
			duration_seconds: null as number | null,
			sort_order: maxSortOrder + 1,
			uploaded_at: new Date().toISOString(),
		};

		db.insert(musicTracks).values(newTrack).run();
		musicPlayer?.reloadPlaylist();

		const { file_path: _fp, ...trackResponse } = newTrack;
		return reply.status(201).send({ ok: true, data: trackResponse });
	});

	// DELETE /api/v1/music/tracks/:id — delete a track
	app.delete("/api/v1/music/tracks/:id", { preHandler: requireAdmin }, async (request, reply) => {
		const { id } = request.params as { id: string };
		const track = db.select().from(musicTracks).where(eq(musicTracks.id, id)).get();

		if (!track) {
			return reply
				.status(404)
				.send({ ok: false, error: { code: "NOT_FOUND", message: "Parça bulunamadı" } });
		}

		db.delete(musicTracks).where(eq(musicTracks.id, id)).run();
		await unlink(track.file_path).catch(() => undefined);
		musicPlayer?.reloadPlaylist();

		return { ok: true, data: null };
	});

	// PATCH /api/v1/music/tracks/:id — update display_name or sort_order
	app.patch("/api/v1/music/tracks/:id", { preHandler: requireAdmin }, async (request, reply) => {
		const { id } = request.params as { id: string };
		const body = request.body as { display_name?: string; sort_order?: number };

		const track = db.select().from(musicTracks).where(eq(musicTracks.id, id)).get();
		if (!track) {
			return reply
				.status(404)
				.send({ ok: false, error: { code: "NOT_FOUND", message: "Parça bulunamadı" } });
		}

		const updates: Partial<typeof track> = {};
		if (typeof body.display_name === "string" && body.display_name.trim()) {
			updates.display_name = body.display_name.trim();
		}
		if (typeof body.sort_order === "number" && Number.isInteger(body.sort_order)) {
			updates.sort_order = body.sort_order;
		}

		if (Object.keys(updates).length > 0) {
			db.update(musicTracks).set(updates).where(eq(musicTracks.id, id)).run();
		}

		return { ok: true, data: null };
	});

	// POST /api/v1/music/play
	app.post("/api/v1/music/play", { preHandler: requireAdmin }, async () => {
		musicPlayer?.play();
		return { ok: true, data: null };
	});

	// POST /api/v1/music/pause
	app.post("/api/v1/music/pause", { preHandler: requireAdmin }, async () => {
		musicPlayer?.pause();
		return { ok: true, data: null };
	});

	// POST /api/v1/music/skip
	app.post("/api/v1/music/skip", { preHandler: requireAdmin }, async () => {
		musicPlayer?.skip();
		return { ok: true, data: null };
	});

	// POST /api/v1/music/previous
	app.post("/api/v1/music/previous", { preHandler: requireAdmin }, async () => {
		musicPlayer?.previous();
		return { ok: true, data: null };
	});

	// PATCH /api/v1/music/volume
	app.patch("/api/v1/music/volume", { preHandler: requireAdmin }, async (request, reply) => {
		const body = request.body as { volume?: unknown };
		const volume = Number(body?.volume);
		if (!Number.isInteger(volume) || volume < 0 || volume > 100) {
			return reply.status(400).send({
				ok: false,
				error: { code: "VALIDATION_ERROR", message: "volume must be an integer between 0 and 100" },
			});
		}

		db.insert(appSettings)
			.values({
				key: SETTING_KEYS.MUSIC_VOLUME,
				value: String(volume),
				updated_at: new Date().toISOString(),
			})
			.onConflictDoUpdate({
				target: appSettings.key,
				set: { value: String(volume), updated_at: new Date().toISOString() },
			})
			.run();

		musicPlayer?.setVolume(volume);
		return { ok: true, data: null };
	});
}
