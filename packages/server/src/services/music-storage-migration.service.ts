import { access, copyFile, mkdir, rename, unlink } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { eq } from "drizzle-orm";
import type { AppDatabase } from "../db/connection.js";
import { appSettings, musicTracks } from "../db/schema.js";

interface MigrationLogger {
	info: (obj: Record<string, unknown>, msg?: string) => void;
	warn: (obj: Record<string, unknown>, msg?: string) => void;
	error: (obj: Record<string, unknown>, msg?: string) => void;
}

const MUSIC_STORAGE_MIGRATED_KEY = "music_storage_migrated_v1";

async function moveFile(oldPath: string, newPath: string): Promise<void> {
	try {
		await rename(oldPath, newPath);
	} catch {
		// Cross-device move fallback.
		await copyFile(oldPath, newPath);
		await unlink(oldPath);
	}
}

function isMigrationMarkedDone(db: AppDatabase): boolean {
	const row = db
		.select({ value: appSettings.value })
		.from(appSettings)
		.where(eq(appSettings.key, MUSIC_STORAGE_MIGRATED_KEY))
		.get();
	return row?.value === "1";
}

function markMigrationDone(db: AppDatabase): void {
	const now = new Date().toISOString();
	db.insert(appSettings)
		.values({
			key: MUSIC_STORAGE_MIGRATED_KEY,
			value: "1",
			updated_at: now,
		})
		.onConflictDoUpdate({
			target: appSettings.key,
			set: {
				value: "1",
				updated_at: now,
			},
		})
		.run();
}

/**
 * One-shot migration for legacy music path mismatch:
 * old: packages/assets/music
 * new: packages/server/assets/music
 */
export async function migrateLegacyMusicStorage(opts: {
	db: AppDatabase;
	musicPath: string;
	legacyMusicPath: string;
	logger: MigrationLogger;
}): Promise<void> {
	if (isMigrationMarkedDone(opts.db)) return;

	const targetDir = resolve(opts.musicPath);
	const legacyDir = resolve(opts.legacyMusicPath);
	if (targetDir === legacyDir) {
		markMigrationDone(opts.db);
		return;
	}

	await mkdir(targetDir, { recursive: true });

	const legacyPrefix = `${legacyDir}/`;
	const tracks = opts.db
		.select({
			id: musicTracks.id,
			file_path: musicTracks.file_path,
		})
		.from(musicTracks)
		.all();

	let updated = 0;
	let moved = 0;
	let failed = 0;
	for (const track of tracks) {
		if (!track.file_path.startsWith(legacyPrefix)) continue;
		const newPath = resolve(targetDir, basename(track.file_path));
		if (resolve(track.file_path) !== newPath) {
			let canUpdatePath = false;
			try {
				await moveFile(track.file_path, newPath);
				moved += 1;
				canUpdatePath = true;
			} catch (err) {
				opts.logger.warn(
					{
						event: "music.storage.migrate.move_failed",
						trackId: track.id,
						oldPath: track.file_path,
						newPath,
						error: err instanceof Error ? err.message : String(err),
					},
					"Could not move legacy music file",
				);
				try {
					await access(newPath);
					canUpdatePath = true;
				} catch {
					canUpdatePath = false;
				}
			}
			if (!canUpdatePath) {
				failed += 1;
				continue;
			}
			opts.db
				.update(musicTracks)
				.set({ file_path: newPath })
				.where(eq(musicTracks.id, track.id))
				.run();
			updated += 1;
		}
	}

	if (failed > 0) {
		opts.logger.warn(
			{
				event: "music.storage.migrate.partial",
				updatedTracks: updated,
				movedFiles: moved,
				failedTracks: failed,
			},
			"Legacy music storage migration incomplete; will retry on next boot",
		);
		return;
	}

	markMigrationDone(opts.db);
	if (updated > 0 || moved > 0) {
		opts.logger.info(
			{ event: "music.storage.migrate.done", updatedTracks: updated, movedFiles: moved },
			"Legacy music storage migration completed",
		);
		return;
	}

	opts.logger.info(
		{ event: "music.storage.migrate.noop" },
		"Legacy music storage migration already clean; sentinel marked",
	);
}
