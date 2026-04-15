import { SETTING_KEYS } from "@sepetarasi/shared";
import { describe, expect, it, vi } from "vitest";
import type { AppDatabase } from "../src/db/connection.js";
import { appSettings, musicTracks } from "../src/db/schema.js";
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

type InternalPlayer = {
	proc: {
		stdin: { writable: boolean; write: (cmd: string) => void };
		killed: boolean;
		kill: () => void;
	} | null;
	playlist: Array<{ id: string; file_path: string; display_name: string }>;
	currentIndex: number;
	isPlaying: boolean;
	isPaused: boolean;
	isDucked: boolean;
	fadeTimers: ReturnType<typeof setTimeout>[];
};

function withMockedProc(player: MusicPlayerService, playing = false) {
	const write = vi.fn();
	const internal = player as unknown as InternalPlayer;
	internal.proc = { stdin: { writable: true, write }, killed: false, kill: vi.fn() };
	internal.isPlaying = playing;
	internal.isPaused = false;
	internal.isDucked = false;
	return { internal, write };
}

describe("MusicPlayerService — stop / play / skip / previous", () => {
	it("stop() when proc is null clears state and broadcasts", () => {
		const db = createTestDb();
		const { player, broadcast } = buildPlayer(db);
		// proc is null by default — must not throw
		player.stop();
		expect(broadcast).toHaveBeenCalled();
		const status = player.getStatus();
		expect(status.isPlaying).toBe(false);
		expect(status.isPaused).toBe(false);
	});

	it("play() when proc is null and music disabled is a no-op (no crash)", () => {
		const db = createTestDb();
		const { player } = buildPlayer(db);
		// enabled = false (no DB row), proc = null — calling play() triggers start() which exits early
		expect(() => player.play()).not.toThrow();
	});

	it("skip() with empty playlist is a no-op", () => {
		const db = createTestDb();
		const { player, broadcast } = buildPlayer(db);
		player.skip(); // playlist is empty
		expect(broadcast).not.toHaveBeenCalled();
	});

	it("skip() with no-loop end of playlist sends STOP and broadcasts", () => {
		const db = createTestDb();
		db.insert(appSettings)
			.values([
				{ key: SETTING_KEYS.MUSIC_LOOP_ENABLED, value: "0", updated_at: new Date().toISOString() },
				{
					key: SETTING_KEYS.MUSIC_SHUFFLE_ENABLED,
					value: "0",
					updated_at: new Date().toISOString(),
				},
			])
			.run();

		const { player, broadcast } = buildPlayer(db);
		const { internal, write } = withMockedProc(player, true);
		internal.playlist = [{ id: "a", file_path: "/a.mp3", display_name: "A" }];
		internal.currentIndex = 0; // only one track, no loop → nextIndex = null

		player.skip();

		expect(write).toHaveBeenCalledWith(expect.stringContaining("STOP\n"));
		expect(broadcast).toHaveBeenCalled();
		expect(internal.isPlaying).toBe(false);
	});

	it("previous() decrements index in linear mode when not at start", () => {
		const db = createTestDb();
		db.insert(appSettings)
			.values([
				{
					key: SETTING_KEYS.MUSIC_SHUFFLE_ENABLED,
					value: "0",
					updated_at: new Date().toISOString(),
				},
				{ key: SETTING_KEYS.MUSIC_LOOP_ENABLED, value: "0", updated_at: new Date().toISOString() },
			])
			.run();

		const { player } = buildPlayer(db);
		const internal = player as unknown as InternalPlayer;
		internal.playlist = [
			{ id: "a", file_path: "/a.mp3", display_name: "A" },
			{ id: "b", file_path: "/b.mp3", display_name: "B" },
		];
		internal.currentIndex = 1;
		internal.proc = null;

		player.previous();
		expect(internal.currentIndex).toBe(0);
	});

	it("previous() with empty playlist is a no-op", () => {
		const db = createTestDb();
		const { player } = buildPlayer(db);
		expect(() => player.previous()).not.toThrow();
	});
});

describe("MusicPlayerService — duck / unduck / setVolume", () => {
	it("duck() resolves immediately when proc is null (no crash in announcement worker)", async () => {
		const db = createTestDb();
		const { player } = buildPlayer(db);
		// proc = null → must resolve without hanging
		await expect(player.duck()).resolves.toBeUndefined();
	});

	it("duck() resolves immediately when not playing", async () => {
		const db = createTestDb();
		const { player } = buildPlayer(db);
		withMockedProc(player, false); // isPlaying = false
		await expect(player.duck()).resolves.toBeUndefined();
	});

	it("unduck() is a no-op when proc is null", () => {
		const db = createTestDb();
		const { player } = buildPlayer(db);
		expect(() => player.unduck()).not.toThrow();
	});

	it("unduck() is a no-op when not ducked", () => {
		const db = createTestDb();
		const { player } = buildPlayer(db);
		withMockedProc(player, true);
		// isDucked = false (default) → no-op
		expect(() => player.unduck()).not.toThrow();
	});

	it("setVolume() is a no-op when ducked (does not override fade)", () => {
		const db = createTestDb();
		const { player } = buildPlayer(db);
		const { internal, write } = withMockedProc(player, true);
		internal.isDucked = true;

		player.setVolume(80);
		expect(write).not.toHaveBeenCalled();
	});

	it("setVolume() is a no-op when proc is null", () => {
		const db = createTestDb();
		const { player, broadcast } = buildPlayer(db);
		player.setVolume(80); // proc = null
		expect(broadcast).not.toHaveBeenCalled();
	});
});

describe("MusicPlayerService — getStatus / reloadPlaylist", () => {
	it("getStatus() returns safe defaults when playlist is empty", () => {
		const db = createTestDb();
		const { player } = buildPlayer(db);
		const status = player.getStatus();
		expect(status.isPlaying).toBe(false);
		expect(status.isPaused).toBe(false);
		expect(status.isDucked).toBe(false);
		expect(status.currentTrackId).toBeNull();
		expect(status.currentTrackName).toBeNull();
		expect(typeof status.volume).toBe("number");
	});

	it("reloadPlaylist() with empty DB stops the player", () => {
		const db = createTestDb();
		const { player } = buildPlayer(db);
		const stopSpy = vi.spyOn(player, "stop").mockImplementation(() => undefined);
		// No tracks in DB → reload should stop
		player.reloadPlaylist();
		expect(stopSpy).toHaveBeenCalled();
	});

	it("reloadPlaylist() preserves current track index after reload", () => {
		const db = createTestDb();
		const { player } = buildPlayer(db);
		const internal = player as unknown as InternalPlayer;

		const now = new Date().toISOString();
		db.insert(musicTracks)
			.values([
				{
					id: "t1",
					filename: "a.mp3",
					display_name: "A",
					file_path: "/a.mp3",
					file_size: 100,
					sort_order: 0,
					uploaded_at: now,
				},
				{
					id: "t2",
					filename: "b.mp3",
					display_name: "B",
					file_path: "/b.mp3",
					file_size: 100,
					sort_order: 1,
					uploaded_at: now,
				},
			])
			.run();

		internal.playlist = [
			{ id: "t1", file_path: "/a.mp3", display_name: "A" },
			{ id: "t2", file_path: "/b.mp3", display_name: "B" },
		];
		internal.currentIndex = 1; // currently on t2

		player.reloadPlaylist();

		// After reload, currentIndex should still point to t2
		expect(internal.currentIndex).toBe(1);
	});
});
