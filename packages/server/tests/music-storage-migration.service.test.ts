import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appSettings, musicTracks } from "../src/db/schema.js";
import { createTestDb } from "../src/db/test-utils.js";
import { migrateLegacyMusicStorage } from "../src/services/music-storage-migration.service.js";

const MIGRATION_KEY = "music_storage_migrated_v1";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs) {
		rmSync(dir, { recursive: true, force: true });
	}
	tempDirs.length = 0;
});

function makeTempDir(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	tempDirs.push(dir);
	return dir;
}

function createLogger() {
	return {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	};
}

describe("migrateLegacyMusicStorage", () => {
	it("moves legacy-path tracks and marks sentinel once completed", async () => {
		const db = createTestDb();
		const legacyDir = makeTempDir("sepetarasi-legacy-music-");
		const targetDir = makeTempDir("sepetarasi-target-music-");
		const fileName = "test-track.mp3";
		const oldPath = join(legacyDir, fileName);
		writeFileSync(oldPath, Buffer.from("mp3-data"));

		db.insert(musicTracks)
			.values({
				id: "track-1",
				filename: fileName,
				display_name: "Test Track",
				file_path: oldPath,
				file_size: 8,
				duration_seconds: null,
				sort_order: 0,
				uploaded_at: new Date().toISOString(),
			})
			.run();

		const logger = createLogger();
		await migrateLegacyMusicStorage({
			db,
			musicPath: targetDir,
			legacyMusicPath: legacyDir,
			logger,
		});

		const updatedTrack = db.select().from(musicTracks).where(eq(musicTracks.id, "track-1")).get();
		const expectedNewPath = resolve(targetDir, fileName);
		expect(updatedTrack?.file_path).toBe(expectedNewPath);
		expect(existsSync(expectedNewPath)).toBe(true);
		expect(existsSync(oldPath)).toBe(false);

		const sentinel = db.select().from(appSettings).where(eq(appSettings.key, MIGRATION_KEY)).get();
		expect(sentinel?.value).toBe("1");
		expect(logger.info).toHaveBeenCalled();
	});

	it("does not mark sentinel when at least one legacy track cannot be migrated", async () => {
		const db = createTestDb();
		const legacyDir = makeTempDir("sepetarasi-legacy-music-fail-");
		const targetDir = makeTempDir("sepetarasi-target-music-fail-");
		const missingOldPath = join(legacyDir, "missing-track.mp3");

		db.insert(musicTracks)
			.values({
				id: "track-fail-1",
				filename: "missing-track.mp3",
				display_name: "Missing Track",
				file_path: missingOldPath,
				file_size: 12,
				duration_seconds: null,
				sort_order: 0,
				uploaded_at: new Date().toISOString(),
			})
			.run();

		const logger = createLogger();
		await migrateLegacyMusicStorage({
			db,
			musicPath: targetDir,
			legacyMusicPath: legacyDir,
			logger,
		});

		const sentinel = db.select().from(appSettings).where(eq(appSettings.key, MIGRATION_KEY)).get();
		expect(sentinel).toBeUndefined();
		expect(logger.warn).toHaveBeenCalled();
	});
});
