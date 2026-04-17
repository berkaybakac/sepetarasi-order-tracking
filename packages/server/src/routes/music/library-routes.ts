import { randomUUID } from "node:crypto";
import { createWriteStream, statfsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import type { MusicTrack } from "@sepetarasi/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { AppDatabase } from "../../db/connection.js";
import { musicTracks } from "../../db/schema.js";
import type { MusicPlayerService } from "../../services/music-player.service.js";
import { getAudioMetadata, getMusicQualityWarnings } from "../../utils/audio-metadata.js";
import { requireAdmin } from "../../utils/auth-middleware.js";

const ACCEPTED_MIME_TYPES = new Set(["audio/mpeg", "audio/mp3", "audio/x-mpeg"]);
const MIN_FREE_DISK_MB = 100;
const MUSIC_UPLOAD_RATE_LIMIT = { max: 300, timeWindow: "1 minute" } as const;

interface MultipartMusicFile {
	filename: string;
	mimetype: string;
	file: NodeJS.ReadableStream & { truncated?: boolean };
}

function isMp3Upload(part: MultipartMusicFile): boolean {
	return ACCEPTED_MIME_TYPES.has(part.mimetype) || part.filename.toLowerCase().endsWith(".mp3");
}

export function registerMusicLibraryRoutes(
	app: FastifyInstance,
	db: AppDatabase,
	musicPath: string,
	musicPlayer: MusicPlayerService | null,
	maxUploadBytes: number,
): void {
	const maxUploadSizeMb = Math.floor(maxUploadBytes / 1024 / 1024);

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

	app.post(
		"/api/v1/music/tracks",
		{
			preHandler: requireAdmin,
			config: {
				// Keep upload traffic in its own bucket so active admin screens do not consume it.
				rateLimit: MUSIC_UPLOAD_RATE_LIMIT,
			},
		},
		async (request, reply) => {
			// `inject` test requests may not expose setTimeout on the raw stream.
			if (typeof request.raw.setTimeout === "function") {
				request.raw.setTimeout(0);
			}

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
			} catch {
				// If statfs fails (e.g., in tests), proceed.
			}

			let data: MultipartMusicFile | undefined;
			try {
				data = await (
					request as unknown as {
						file: (opts?: {
							limits?: { fileSize?: number };
							throwFileSizeLimit?: boolean;
						}) => Promise<MultipartMusicFile | undefined>;
					}
				).file({
					limits: { fileSize: maxUploadBytes },
					throwFileSizeLimit: false,
				});
			} catch (err) {
				request.log.warn(
					{
						event: "music.upload.multipart_error",
						error: err instanceof Error ? err.message : String(err),
					},
					"Multipart parser rejected music upload",
				);
				return reply.status(413).send({
					ok: false,
					error: {
						code: "FILE_TOO_LARGE",
						message: `Dosya boyutu en fazla ${maxUploadSizeMb} MB olabilir`,
					},
				});
			}

			if (!data) {
				return reply.status(400).send({
					ok: false,
					error: { code: "VALIDATION_ERROR", message: "Yüklenecek MP3 dosyası bulunamadı" },
				});
			}

			if (!isMp3Upload(data)) {
				data.file.resume();
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
				data.file.on("data", (chunk: Buffer) => {
					fileSize += chunk.length;
				});
				await pipeline(data.file, writeStream);
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

			if (data.file.truncated || fileSize > maxUploadBytes) {
				await unlink(targetPath).catch(() => undefined);
				return reply.status(413).send({
					ok: false,
					error: {
						code: "FILE_TOO_LARGE",
						message: `Dosya boyutu en fazla ${maxUploadSizeMb} MB olabilir`,
					},
				});
			}

			if (fileSize <= 0) {
				await unlink(targetPath).catch(() => undefined);
				return reply.status(400).send({
					ok: false,
					error: { code: "EMPTY_FILE", message: "Boş dosya yüklenemez" },
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

			const metadata = await getAudioMetadata(targetPath);
			const duration = metadata?.durationSeconds ?? null;
			if (metadata === null) {
				request.log.warn(
					{ event: "music.upload.metadata_extraction_failed", filename: data.filename },
					"Could not extract audio metadata from music file",
				);
			}
			const qualityWarnings = metadata ? getMusicQualityWarnings(metadata) : [];
			if (qualityWarnings.length > 0 && metadata) {
				request.log.warn(
					{
						event: "music.upload.quality_warning",
						filename: data.filename,
						codecName: metadata.codecName,
						formatName: metadata.formatName,
						sampleRateHz: metadata.sampleRateHz,
						bitRateKbps: metadata.bitRateKbps,
						channels: metadata.channels,
						qualityWarnings,
					},
					"Uploaded music track has potential audio quality issues",
				);
			}

			const newTrackRow = {
				id,
				filename: data.filename,
				display_name: displayName,
				file_path: targetPath,
				file_size: fileSize,
				duration_seconds: duration,
				sort_order: maxSortOrder + 1,
				uploaded_at: new Date().toISOString(),
			};
			db.insert(musicTracks).values(newTrackRow).run();
			request.log.info(
				{
					event: "music.upload.success",
					trackId: id,
					filename: data.filename,
					file_size: fileSize,
					duration_seconds: duration,
					codecName: metadata?.codecName ?? null,
					formatName: metadata?.formatName ?? null,
					sampleRateHz: metadata?.sampleRateHz ?? null,
					bitRateKbps: metadata?.bitRateKbps ?? null,
					channels: metadata?.channels ?? null,
				},
				"Music track uploaded",
			);

			musicPlayer?.reloadPlaylist();
			if (musicPlayer?.getStatus().enabled) {
				musicPlayer.play();
			}

			const trackResponse: MusicTrack = {
				id: newTrackRow.id,
				filename: newTrackRow.filename,
				display_name: newTrackRow.display_name,
				file_size: newTrackRow.file_size,
				duration_seconds: newTrackRow.duration_seconds,
				sort_order: newTrackRow.sort_order,
				uploaded_at: newTrackRow.uploaded_at,
			};
			return reply.status(201).send({ ok: true, data: trackResponse });
		},
	);

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
		request.log.info(
			{ event: "music.track.deleted", trackId: id, filename: track.filename },
			"Music track deleted",
		);
		musicPlayer?.reloadPlaylist();

		return { ok: true, data: null };
	});

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
			musicPlayer?.reloadPlaylist();
		}

		return { ok: true, data: null };
	});
}
