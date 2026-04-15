import { SETTING_KEYS } from "@sepetarasi/shared";
import { describe, expect, it, vi } from "vitest";
import type { AppDatabase } from "../src/db/connection.js";
import { appSettings } from "../src/db/schema.js";
import { createTestDb } from "../src/db/test-utils.js";
import { MusicPlayerService } from "../src/services/music-player.service.js";

function buildPlayer(db: AppDatabase) {
	const broadcaster = {
		broadcast: vi.fn(),
	};
	return {
		player: new MusicPlayerService({ db, broadcaster: broadcaster as never }),
		broadcast: broadcaster.broadcast,
	};
}

describe("MusicPlayerService pause/play semantics", () => {
	it("toggles pause even when already paused (pause -> play resume)", () => {
		const db = createTestDb();
		const { player } = buildPlayer(db);
		const internal = player as unknown as {
			proc: { stdin: { writable: boolean; write: (cmd: string) => void } };
			isPlaying: boolean;
			isPaused: boolean;
		};

		const write = vi.fn();
		internal.proc = { stdin: { writable: true, write } };
		internal.isPlaying = true;
		internal.isPaused = false;

		player.pause();
		expect(internal.isPaused).toBe(true);
		expect(internal.isPlaying).toBe(false);

		player.pause();
		expect(internal.isPaused).toBe(false);
		expect(internal.isPlaying).toBe(true);
		expect(write).toHaveBeenCalledTimes(2);
		expect(write.mock.calls[0][0]).toContain("PAUSE");
		expect(write.mock.calls[1][0]).toContain("PAUSE");
	});

	it("setEnabled applies immediately by calling start/stop", () => {
		const db = createTestDb();
		const { player } = buildPlayer(db);
		const startSpy = vi.spyOn(player, "start").mockImplementation(() => undefined);
		const stopSpy = vi.spyOn(player, "stop").mockImplementation(() => undefined);

		player.setEnabled(true);
		player.setEnabled(false);

		expect(startSpy).toHaveBeenCalledTimes(1);
		expect(stopSpy).toHaveBeenCalledTimes(1);
	});

	it("loop mode wraps to first track at playlist end", () => {
		const db = createTestDb();
		db.insert(appSettings)
			.values([
				{
					key: SETTING_KEYS.MUSIC_LOOP_ENABLED,
					value: "1",
					updated_at: new Date().toISOString(),
				},
				{
					key: SETTING_KEYS.MUSIC_SHUFFLE_ENABLED,
					value: "0",
					updated_at: new Date().toISOString(),
				},
			])
			.run();

		const { player } = buildPlayer(db);
		const internal = player as unknown as {
			playlist: Array<{ id: string }>;
			currentIndex: number;
			resolveNextIndex: () => number | null;
		};
		internal.playlist = [{ id: "a" }, { id: "b" }];
		internal.currentIndex = 1;

		expect(internal.resolveNextIndex()).toBe(0);
	});

	it("shuffle mode picks a different next track", () => {
		const db = createTestDb();
		db.insert(appSettings)
			.values([
				{
					key: SETTING_KEYS.MUSIC_LOOP_ENABLED,
					value: "1",
					updated_at: new Date().toISOString(),
				},
				{
					key: SETTING_KEYS.MUSIC_SHUFFLE_ENABLED,
					value: "1",
					updated_at: new Date().toISOString(),
				},
			])
			.run();

		const { player } = buildPlayer(db);
		const internal = player as unknown as {
			playlist: Array<{ id: string }>;
			currentIndex: number;
			resolveNextIndex: () => number | null;
		};
		internal.playlist = [{ id: "a" }, { id: "b" }, { id: "c" }];
		internal.currentIndex = 0;

		const randomSpy = vi.spyOn(Math, "random");
		randomSpy.mockReturnValueOnce(0.01); // -> 0 (same, retry)
		randomSpy.mockReturnValueOnce(0.7); // -> 2 (different)
		const next = internal.resolveNextIndex();
		randomSpy.mockRestore();

		expect(next).not.toBe(0);
		expect(next).toBe(2);
	});

	it("non-loop mode returns null when at end of playlist", () => {
		const db = createTestDb();
		db.insert(appSettings)
			.values([
				{
					key: SETTING_KEYS.MUSIC_LOOP_ENABLED,
					value: "0",
					updated_at: new Date().toISOString(),
				},
				{
					key: SETTING_KEYS.MUSIC_SHUFFLE_ENABLED,
					value: "0",
					updated_at: new Date().toISOString(),
				},
			])
			.run();

		const { player } = buildPlayer(db);
		const internal = player as unknown as {
			playlist: Array<{ id: string }>;
			currentIndex: number;
			resolveNextIndex: () => number | null;
		};
		internal.playlist = [{ id: "a" }, { id: "b" }];
		internal.currentIndex = 1; // last track

		expect(internal.resolveNextIndex()).toBeNull();
	});

	it("consecutive load failures trigger halt after threshold", () => {
		const db = createTestDb();
		const { player } = buildPlayer(db);
		const stopSpy = vi.spyOn(player, "stop").mockImplementation(() => undefined);

		const internal = player as unknown as {
			proc: { stdin: { writable: boolean; write: () => void }; killed: boolean; kill: () => void };
			playlist: Array<{ id: string; file_path: string; display_name: string }>;
			currentIndex: number;
			consecutiveLoadFailures: number;
			lastLoadAt: number;
			handleMpg123Line: (line: string) => void;
		};

		internal.proc = {
			stdin: { writable: true, write: () => undefined },
			killed: false,
			kill: () => undefined,
		};
		internal.playlist = [
			{ id: "a", file_path: "/missing/a.mp3", display_name: "A" },
			{ id: "b", file_path: "/missing/b.mp3", display_name: "B" },
		];
		internal.currentIndex = 0;

		// Simulate 3 immediate failures (elapsed < 500ms threshold)
		for (let i = 0; i < 3; i++) {
			internal.lastLoadAt = Date.now();
			internal.handleMpg123Line("@P 0");
		}

		expect(stopSpy).toHaveBeenCalled();
	});
});
