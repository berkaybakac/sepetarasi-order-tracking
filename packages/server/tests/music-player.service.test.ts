import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

	it("shuffle mode consumes each queued track once before stopping", () => {
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
					value: "1",
					updated_at: new Date().toISOString(),
				},
			])
			.run();

		const { player } = buildPlayer(db);
		const internal = player as unknown as {
			playlist: Array<{ id: string }>;
			currentIndex: number;
			shuffleQueue: string[];
			resolveNextIndex: () => number | null;
		};
		internal.playlist = [{ id: "a" }, { id: "b" }, { id: "c" }];
		internal.currentIndex = 0;
		internal.shuffleQueue = ["c", "b"];

		const firstNext = internal.resolveNextIndex();
		internal.currentIndex = firstNext ?? 0;
		const secondNext = internal.resolveNextIndex();
		internal.currentIndex = secondNext ?? 0;
		const finalNext = internal.resolveNextIndex();

		expect(firstNext).toBe(2);
		expect(secondNext).toBe(1);
		expect(finalNext).toBeNull();
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
	shuffleQueue: string[];
	shuffleHistory: string[];
	isPlaying: boolean;
	isPaused: boolean;
	isDucked: boolean;
	fadeTimers: ReturnType<typeof setTimeout>[];
	lastLoadAt?: number;
	awaitingPlaybackConfirmation?: boolean;
	handleMpg123Line?: (line: string) => void;
};

function withMockedProc(player: MusicPlayerService, playing = false) {
	const write = vi.fn();
	const internal = player as unknown as InternalPlayer;
	internal.proc = { stdin: { writable: true, write }, killed: false, kill: vi.fn() };
	internal.isPlaying = playing;
	internal.isPaused = false;
	internal.isDucked = false;
	internal.shuffleQueue = [];
	internal.shuffleHistory = [];
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

	it("skip() wraps to first track at playlist end even when loop is off", () => {
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
		const tempDir = mkdtempSync(join(tmpdir(), "sepetarasi-skip-wrap-"));
		const firstTrackPath = join(tempDir, "a.mp3");
		const secondTrackPath = join(tempDir, "b.mp3");
		writeFileSync(firstTrackPath, "fake-mp3-a");
		writeFileSync(secondTrackPath, "fake-mp3-b");

		try {
			internal.playlist = [
				{ id: "a", file_path: firstTrackPath, display_name: "A" },
				{ id: "b", file_path: secondTrackPath, display_name: "B" },
			];
			internal.currentIndex = 1; // last track, no loop → manual next should wrap

			player.skip();

			expect(internal.currentIndex).toBe(0);
			expect(write).toHaveBeenCalledWith(expect.stringContaining(`LOAD ${firstTrackPath}\n`));
			expect(broadcast).toHaveBeenCalled();
			expect(internal.isPlaying).toBe(true);
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
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

	it("previous() wraps to last track when current track is the first one", () => {
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
		internal.currentIndex = 0;
		internal.proc = null;

		player.previous();
		expect(internal.currentIndex).toBe(1);
	});

	it("previous() with empty playlist is a no-op", () => {
		const db = createTestDb();
		const { player } = buildPlayer(db);
		expect(() => player.previous()).not.toThrow();
	});

	it("shuffle previous() goes back through played history", () => {
		const db = createTestDb();
		db.insert(appSettings)
			.values([
				{ key: SETTING_KEYS.MUSIC_LOOP_ENABLED, value: "1", updated_at: new Date().toISOString() },
				{
					key: SETTING_KEYS.MUSIC_SHUFFLE_ENABLED,
					value: "1",
					updated_at: new Date().toISOString(),
				},
			])
			.run();

		const { player } = buildPlayer(db);
		const { internal, write } = withMockedProc(player, true);
		const tempDir = mkdtempSync(join(tmpdir(), "sepetarasi-shuffle-prev-"));
		const trackAPath = join(tempDir, "a.mp3");
		const trackBPath = join(tempDir, "b.mp3");
		const trackCPath = join(tempDir, "c.mp3");
		writeFileSync(trackAPath, "fake-mp3-a");
		writeFileSync(trackBPath, "fake-mp3-b");
		writeFileSync(trackCPath, "fake-mp3-c");

		try {
			internal.playlist = [
				{ id: "a", file_path: trackAPath, display_name: "A" },
				{ id: "b", file_path: trackBPath, display_name: "B" },
				{ id: "c", file_path: trackCPath, display_name: "C" },
			];
			internal.currentIndex = 2;
			internal.shuffleHistory = ["a", "b"];
			internal.shuffleQueue = [];

			player.previous();

			expect(internal.currentIndex).toBe(1);
			expect(internal.shuffleHistory).toEqual(["a"]);
			expect(internal.shuffleQueue).toEqual(["c"]);
			expect(write).toHaveBeenCalledWith(expect.stringContaining(`LOAD ${trackBPath}\n`));
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("shuffle previous() skips stale history ids no longer in the playlist", () => {
		const db = createTestDb();
		db.insert(appSettings)
			.values([
				{ key: SETTING_KEYS.MUSIC_LOOP_ENABLED, value: "1", updated_at: new Date().toISOString() },
				{
					key: SETTING_KEYS.MUSIC_SHUFFLE_ENABLED,
					value: "1",
					updated_at: new Date().toISOString(),
				},
			])
			.run();

		const { player } = buildPlayer(db);
		const { internal, write } = withMockedProc(player, true);
		const tempDir = mkdtempSync(join(tmpdir(), "sepetarasi-shuffle-prev-stale-"));
		const trackAPath = join(tempDir, "a.mp3");
		const trackBPath = join(tempDir, "b.mp3");
		writeFileSync(trackAPath, "fake-mp3-a");
		writeFileSync(trackBPath, "fake-mp3-b");

		try {
			internal.playlist = [
				{ id: "a", file_path: trackAPath, display_name: "A" },
				{ id: "b", file_path: trackBPath, display_name: "B" },
			];
			internal.currentIndex = 1;
			internal.shuffleHistory = ["a", "removed"];
			internal.shuffleQueue = [];

			player.previous();

			expect(internal.currentIndex).toBe(0);
			expect(internal.shuffleHistory).toEqual([]);
			expect(write).toHaveBeenCalledWith(expect.stringContaining(`LOAD ${trackAPath}\n`));
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("shuffle previous() with empty history falls back to a random other track", () => {
		const db = createTestDb();
		db.insert(appSettings)
			.values([
				{ key: SETTING_KEYS.MUSIC_LOOP_ENABLED, value: "1", updated_at: new Date().toISOString() },
				{
					key: SETTING_KEYS.MUSIC_SHUFFLE_ENABLED,
					value: "1",
					updated_at: new Date().toISOString(),
				},
			])
			.run();

		const { player } = buildPlayer(db);
		const { internal, write } = withMockedProc(player, true);
		const tempDir = mkdtempSync(join(tmpdir(), "sepetarasi-shuffle-prev-fallback-"));
		const trackAPath = join(tempDir, "a.mp3");
		const trackBPath = join(tempDir, "b.mp3");
		writeFileSync(trackAPath, "fake-mp3-a");
		writeFileSync(trackBPath, "fake-mp3-b");

		const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.1);

		try {
			internal.playlist = [
				{ id: "a", file_path: trackAPath, display_name: "A" },
				{ id: "b", file_path: trackBPath, display_name: "B" },
			];
			internal.currentIndex = 1;
			internal.shuffleHistory = [];
			internal.shuffleQueue = [];

			player.previous();

			expect(internal.currentIndex).toBe(0);
			expect(write).toHaveBeenCalledWith(expect.stringContaining(`LOAD ${trackAPath}\n`));
		} finally {
			randomSpy.mockRestore();
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("shuffle next() skips stale queue ids no longer in the playlist", () => {
		const db = createTestDb();
		db.insert(appSettings)
			.values([
				{ key: SETTING_KEYS.MUSIC_LOOP_ENABLED, value: "0", updated_at: new Date().toISOString() },
				{
					key: SETTING_KEYS.MUSIC_SHUFFLE_ENABLED,
					value: "1",
					updated_at: new Date().toISOString(),
				},
			])
			.run();

		const { player } = buildPlayer(db);
		const { internal, write } = withMockedProc(player, true);
		const tempDir = mkdtempSync(join(tmpdir(), "sepetarasi-shuffle-next-stale-"));
		const trackAPath = join(tempDir, "a.mp3");
		const trackBPath = join(tempDir, "b.mp3");
		writeFileSync(trackAPath, "fake-mp3-a");
		writeFileSync(trackBPath, "fake-mp3-b");

		try {
			internal.playlist = [
				{ id: "a", file_path: trackAPath, display_name: "A" },
				{ id: "b", file_path: trackBPath, display_name: "B" },
			];
			internal.currentIndex = 0;
			internal.shuffleQueue = ["removed", "b"];

			player.skip();

			expect(internal.currentIndex).toBe(1);
			expect(write).toHaveBeenCalledWith(expect.stringContaining(`LOAD ${trackBPath}\n`));
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("broadcastStatus swallows broadcaster failures without crashing", () => {
		const db = createTestDb();
		const broadcaster = {
			broadcast: vi.fn(() => {
				throw new Error("ws down");
			}),
		};
		const player = new MusicPlayerService({ db, broadcaster: broadcaster as never });
		const internal = player as unknown as { broadcastStatus: () => void };
		expect(() => internal.broadcastStatus()).not.toThrow();
		expect(broadcaster.broadcast).toHaveBeenCalled();
	});

	it("shuffle next() starts a new shuffled cycle when the queue is exhausted", () => {
		const db = createTestDb();
		db.insert(appSettings)
			.values([
				{ key: SETTING_KEYS.MUSIC_LOOP_ENABLED, value: "0", updated_at: new Date().toISOString() },
				{
					key: SETTING_KEYS.MUSIC_SHUFFLE_ENABLED,
					value: "1",
					updated_at: new Date().toISOString(),
				},
			])
			.run();

		const { player } = buildPlayer(db);
		const { internal, write } = withMockedProc(player, true);
		const tempDir = mkdtempSync(join(tmpdir(), "sepetarasi-shuffle-next-cycle-"));
		const trackAPath = join(tempDir, "a.mp3");
		const trackBPath = join(tempDir, "b.mp3");
		const trackCPath = join(tempDir, "c.mp3");
		writeFileSync(trackAPath, "fake-mp3-a");
		writeFileSync(trackBPath, "fake-mp3-b");
		writeFileSync(trackCPath, "fake-mp3-c");

		const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.9);

		try {
			internal.playlist = [
				{ id: "a", file_path: trackAPath, display_name: "A" },
				{ id: "b", file_path: trackBPath, display_name: "B" },
				{ id: "c", file_path: trackCPath, display_name: "C" },
			];
			internal.currentIndex = 2;
			internal.shuffleQueue = [];

			player.skip();

			expect(internal.currentIndex).toBe(0);
			expect(internal.isPlaying).toBe(true);
			expect(internal.shuffleHistory).toEqual([]);
			expect(write).toHaveBeenCalledWith(expect.stringContaining(`LOAD ${trackAPath}\n`));
		} finally {
			randomSpy.mockRestore();
			rmSync(tempDir, { recursive: true, force: true });
		}
	});
});

describe("MusicPlayerService — verified play diagnostics", () => {
	it("playAndVerify() fails with a developer-visible issue when music is disabled", async () => {
		const db = createTestDb();
		const { player } = buildPlayer(db);

		const result = await player.playAndVerify(10);

		expect(result.ok).toBe(false);
		expect(result.code).toBe("MUSIC_DISABLED");
		expect(player.getStatus().runtimeIssue?.code).toBe("MUSIC_DISABLED");
	});

	it("playAndVerify() waits for @P 2 confirmation before succeeding", async () => {
		const db = createTestDb();
		db.insert(appSettings)
			.values({
				key: SETTING_KEYS.MUSIC_ENABLED,
				value: "1",
				updated_at: new Date().toISOString(),
			})
			.onConflictDoUpdate({
				target: appSettings.key,
				set: { value: "1", updated_at: new Date().toISOString() },
			})
			.run();

		const { player } = buildPlayer(db);
		const { internal, write } = withMockedProc(player, false);
		internal.playlist = [{ id: "a", file_path: "/tmp/a.mp3", display_name: "A" }];
		internal.isPaused = true;

		const resultPromise = player.playAndVerify(50);
		setTimeout(() => internal.handleMpg123Line?.("@P 2"), 5);

		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(write).toHaveBeenCalledWith(expect.stringContaining("PAUSE\n"));
		expect(player.getStatus().runtimeIssue).toBeNull();
	});

	it("playAndVerify() returns a failure when playback confirmation times out", async () => {
		const db = createTestDb();
		db.insert(appSettings)
			.values({
				key: SETTING_KEYS.MUSIC_ENABLED,
				value: "1",
				updated_at: new Date().toISOString(),
			})
			.onConflictDoUpdate({
				target: appSettings.key,
				set: { value: "1", updated_at: new Date().toISOString() },
			})
			.run();

		const { player } = buildPlayer(db);
		const { internal, write } = withMockedProc(player, false);
		internal.playlist = [{ id: "a", file_path: "/tmp/a.mp3", display_name: "A" }];
		internal.isPaused = true;

		const result = await player.playAndVerify(10);

		expect(result.ok).toBe(false);
		expect(result.code).toBe("PLAYBACK_NOT_CONFIRMED");
		expect(write).toHaveBeenCalledWith(expect.stringContaining("PAUSE\n"));
		expect(player.getStatus().runtimeIssue?.code).toBe("PLAYBACK_NOT_CONFIRMED");
	});
});

describe("MusicPlayerService — automatic end-of-track transitions", () => {
	it("stops advancing at the end when both loop and shuffle are off", () => {
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
		internal.playlist = [
			{ id: "a", file_path: "/a.mp3", display_name: "A" },
			{ id: "b", file_path: "/b.mp3", display_name: "B" },
		];
		internal.currentIndex = 1;
		internal.lastLoadAt = Date.now() - 1000;

		internal.handleMpg123Line?.("@P 0");

		expect(internal.currentIndex).toBe(1);
		expect(internal.isPlaying).toBe(false);
		expect(internal.isPaused).toBe(false);
		expect(write).not.toHaveBeenCalled();
		expect(broadcast).toHaveBeenCalled();
	});

	it("wraps to the first track at the end when loop is on", () => {
		const db = createTestDb();
		db.insert(appSettings)
			.values([
				{ key: SETTING_KEYS.MUSIC_LOOP_ENABLED, value: "1", updated_at: new Date().toISOString() },
				{
					key: SETTING_KEYS.MUSIC_SHUFFLE_ENABLED,
					value: "0",
					updated_at: new Date().toISOString(),
				},
			])
			.run();

		const { player } = buildPlayer(db);
		const { internal, write } = withMockedProc(player, true);
		const tempDir = mkdtempSync(join(tmpdir(), "sepetarasi-auto-loop-"));
		const firstTrackPath = join(tempDir, "a.mp3");
		const secondTrackPath = join(tempDir, "b.mp3");
		writeFileSync(firstTrackPath, "fake-mp3-a");
		writeFileSync(secondTrackPath, "fake-mp3-b");

		try {
			internal.playlist = [
				{ id: "a", file_path: firstTrackPath, display_name: "A" },
				{ id: "b", file_path: secondTrackPath, display_name: "B" },
			];
			internal.currentIndex = 1;
			internal.lastLoadAt = Date.now() - 1000;

			internal.handleMpg123Line?.("@P 0");

			expect(internal.currentIndex).toBe(0);
			expect(write).toHaveBeenCalledWith(expect.stringContaining(`LOAD ${firstTrackPath}\n`));
			expect(internal.isPlaying).toBe(true);
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("stops after the shuffle queue is exhausted when loop is off", () => {
		const db = createTestDb();
		db.insert(appSettings)
			.values([
				{ key: SETTING_KEYS.MUSIC_LOOP_ENABLED, value: "0", updated_at: new Date().toISOString() },
				{
					key: SETTING_KEYS.MUSIC_SHUFFLE_ENABLED,
					value: "1",
					updated_at: new Date().toISOString(),
				},
			])
			.run();

		const { player } = buildPlayer(db);
		const { internal, write } = withMockedProc(player, true);
		const tempDir = mkdtempSync(join(tmpdir(), "sepetarasi-auto-shuffle-"));
		const firstTrackPath = join(tempDir, "a.mp3");
		const secondTrackPath = join(tempDir, "b.mp3");
		const thirdTrackPath = join(tempDir, "c.mp3");
		writeFileSync(firstTrackPath, "fake-mp3-a");
		writeFileSync(secondTrackPath, "fake-mp3-b");
		writeFileSync(thirdTrackPath, "fake-mp3-c");

		const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.1); // -> index 0

		try {
			internal.playlist = [
				{ id: "a", file_path: firstTrackPath, display_name: "A" },
				{ id: "b", file_path: secondTrackPath, display_name: "B" },
				{ id: "c", file_path: thirdTrackPath, display_name: "C" },
			];
			internal.currentIndex = 2;
			internal.shuffleQueue = [];
			internal.lastLoadAt = Date.now() - 1000;

			internal.handleMpg123Line?.("@P 0");

			expect(internal.currentIndex).toBe(2);
			expect(write).not.toHaveBeenCalled();
			expect(internal.isPlaying).toBe(false);
		} finally {
			randomSpy.mockRestore();
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("starts a new shuffled cycle when both loop and shuffle are on", () => {
		const db = createTestDb();
		db.insert(appSettings)
			.values([
				{ key: SETTING_KEYS.MUSIC_LOOP_ENABLED, value: "1", updated_at: new Date().toISOString() },
				{
					key: SETTING_KEYS.MUSIC_SHUFFLE_ENABLED,
					value: "1",
					updated_at: new Date().toISOString(),
				},
			])
			.run();

		const { player } = buildPlayer(db);
		const { internal, write } = withMockedProc(player, true);
		const tempDir = mkdtempSync(join(tmpdir(), "sepetarasi-auto-shuffle-loop-"));
		const trackAPath = join(tempDir, "a.mp3");
		const trackBPath = join(tempDir, "b.mp3");
		const trackCPath = join(tempDir, "c.mp3");
		writeFileSync(trackAPath, "fake-mp3-a");
		writeFileSync(trackBPath, "fake-mp3-b");
		writeFileSync(trackCPath, "fake-mp3-c");

		const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.9);

		try {
			internal.playlist = [
				{ id: "a", file_path: trackAPath, display_name: "A" },
				{ id: "b", file_path: trackBPath, display_name: "B" },
				{ id: "c", file_path: trackCPath, display_name: "C" },
			];
			internal.currentIndex = 2;
			internal.shuffleQueue = [];
			internal.lastLoadAt = Date.now() - 1000;

			internal.handleMpg123Line?.("@P 0");

			expect(internal.currentIndex).toBe(0);
			expect(internal.isPlaying).toBe(true);
			expect(internal.shuffleHistory).toEqual([]);
			expect(write).toHaveBeenCalledWith(expect.stringContaining(`LOAD ${trackAPath}\n`));
		} finally {
			randomSpy.mockRestore();
			rmSync(tempDir, { recursive: true, force: true });
		}
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
		const musicDir = mkdtempSync(join(tmpdir(), "sepetarasi-music-player-"));
		const trackAPath = join(musicDir, "a.mp3");
		const trackBPath = join(musicDir, "b.mp3");
		writeFileSync(trackAPath, "a");
		writeFileSync(trackBPath, "b");

		try {
			const now = new Date().toISOString();
			db.insert(musicTracks)
				.values([
					{
						id: "t1",
						filename: "a.mp3",
						display_name: "A",
						file_path: trackAPath,
						file_size: 100,
						sort_order: 0,
						uploaded_at: now,
					},
					{
						id: "t2",
						filename: "b.mp3",
						display_name: "B",
						file_path: trackBPath,
						file_size: 100,
						sort_order: 1,
						uploaded_at: now,
					},
				])
				.run();

			internal.playlist = [
				{ id: "t1", file_path: trackAPath, display_name: "A" },
				{ id: "t2", file_path: trackBPath, display_name: "B" },
			];
			internal.currentIndex = 1; // currently on t2

			player.reloadPlaylist();

			// After reload, currentIndex should still point to t2
			expect(internal.currentIndex).toBe(1);
		} finally {
			rmSync(musicDir, { recursive: true, force: true });
		}
	});

	it("reloadPlaylist() preserves shuffle progress and appends newly added tracks", () => {
		const db = createTestDb();
		const now = new Date().toISOString();
		db.insert(appSettings)
			.values([
				{ key: SETTING_KEYS.MUSIC_LOOP_ENABLED, value: "1", updated_at: now },
				{ key: SETTING_KEYS.MUSIC_SHUFFLE_ENABLED, value: "1", updated_at: now },
			])
			.run();

		const { player } = buildPlayer(db);
		const internal = player as unknown as InternalPlayer;
		const musicDir = mkdtempSync(join(tmpdir(), "sepetarasi-music-player-shuffle-reload-"));
		const trackAPath = join(musicDir, "a.mp3");
		const trackBPath = join(musicDir, "b.mp3");
		const trackCPath = join(musicDir, "c.mp3");
		const trackDPath = join(musicDir, "d.mp3");
		writeFileSync(trackAPath, "a");
		writeFileSync(trackBPath, "b");
		writeFileSync(trackCPath, "c");
		writeFileSync(trackDPath, "d");

		try {
			db.insert(musicTracks)
				.values([
					{
						id: "t1",
						filename: "a.mp3",
						display_name: "A",
						file_path: trackAPath,
						file_size: 100,
						sort_order: 0,
						uploaded_at: now,
					},
					{
						id: "t2",
						filename: "b.mp3",
						display_name: "B",
						file_path: trackBPath,
						file_size: 100,
						sort_order: 1,
						uploaded_at: now,
					},
					{
						id: "t3",
						filename: "c.mp3",
						display_name: "C",
						file_path: trackCPath,
						file_size: 100,
						sort_order: 2,
						uploaded_at: now,
					},
					{
						id: "t4",
						filename: "d.mp3",
						display_name: "D",
						file_path: trackDPath,
						file_size: 100,
						sort_order: 3,
						uploaded_at: now,
					},
				])
				.run();

			internal.playlist = [
				{ id: "t1", file_path: trackAPath, display_name: "A" },
				{ id: "t2", file_path: trackBPath, display_name: "B" },
				{ id: "t3", file_path: trackCPath, display_name: "C" },
			];
			internal.currentIndex = 1;
			internal.shuffleHistory = ["t1"];
			internal.shuffleQueue = ["t3"];

			player.reloadPlaylist();

			expect(internal.currentIndex).toBe(1);
			expect(internal.shuffleHistory).toEqual(["t1"]);
			expect(internal.shuffleQueue).toEqual(["t3", "t4"]);
		} finally {
			rmSync(musicDir, { recursive: true, force: true });
		}
	});

	it("reloadPlaylist() skips DB rows whose files are missing", () => {
		const db = createTestDb();
		const { player } = buildPlayer(db);
		const internal = player as unknown as InternalPlayer;
		const musicDir = mkdtempSync(join(tmpdir(), "sepetarasi-music-player-"));
		const trackAPath = join(musicDir, "a.mp3");
		writeFileSync(trackAPath, "a");

		try {
			const now = new Date().toISOString();
			db.insert(musicTracks)
				.values([
					{
						id: "t1",
						filename: "a.mp3",
						display_name: "A",
						file_path: trackAPath,
						file_size: 100,
						sort_order: 0,
						uploaded_at: now,
					},
					{
						id: "t2",
						filename: "missing.mp3",
						display_name: "Missing",
						file_path: join(musicDir, "missing.mp3"),
						file_size: 100,
						sort_order: 1,
						uploaded_at: now,
					},
				])
				.run();

			player.reloadPlaylist();

			expect(internal.playlist).toHaveLength(1);
			expect(internal.playlist[0]?.id).toBe("t1");
			expect(internal.currentIndex).toBe(0);
		} finally {
			rmSync(musicDir, { recursive: true, force: true });
		}
	});

	it("loadCurrentTrack() skips missing runtime files and loads the next playable track", () => {
		const db = createTestDb();
		const { player } = buildPlayer(db);
		const musicDir = mkdtempSync(join(tmpdir(), "sepetarasi-music-player-"));
		const validTrackPath = join(musicDir, "valid.mp3");
		writeFileSync(validTrackPath, "valid");

		try {
			const { internal, write } = withMockedProc(player, false);
			const loadCurrentTrack = (
				player as unknown as { loadCurrentTrack: () => void }
			).loadCurrentTrack.bind(player);
			internal.playlist = [
				{ id: "missing", file_path: join(musicDir, "missing.mp3"), display_name: "Missing" },
				{ id: "valid", file_path: validTrackPath, display_name: "Valid" },
			];
			internal.currentIndex = 0;

			loadCurrentTrack();

			expect(internal.playlist).toHaveLength(1);
			expect(internal.playlist[0]?.id).toBe("valid");
			expect(write).toHaveBeenCalledWith(`LOAD ${validTrackPath}\n`);
		} finally {
			rmSync(musicDir, { recursive: true, force: true });
		}
	});
});
