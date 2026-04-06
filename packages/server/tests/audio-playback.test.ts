/**
 * AudioPlaybackService — lean tests covering happy, sad, and critical paths.
 * Strategy: mock node:child_process spawn; real temp dirs control file presence.
 */

import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));

import { spawn } from "node:child_process";
import { AudioPlaybackService } from "../src/services/audio-playback.service.js";

const mockSpawn = vi.mocked(spawn);

function makeProcess(outcome: "close" | "error") {
	const proc = new EventEmitter() as EventEmitter & { kill: () => void };
	proc.kill = vi.fn();
	setTimeout(() => {
		if (outcome === "close") proc.emit("close", 0);
		else proc.emit("error", Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" }));
	}, 5);
	return proc;
}

function makeProcessWithCloseCode(code: number) {
	const proc = new EventEmitter() as EventEmitter & { kill: () => void };
	proc.kill = vi.fn();
	setTimeout(() => proc.emit("close", code), 5);
	return proc;
}

function makeHangingProcess() {
	const proc = new EventEmitter() as EventEmitter & { kill: () => void };
	proc.kill = vi.fn();
	return proc;
}

let tempDir: string;

beforeEach(() => {
	tempDir = mkdtempSync(join(tmpdir(), "sepetarasi-audio-"));
	mockSpawn.mockClear();
});

afterEach(() => {
	rmSync(tempDir, { recursive: true, force: true });
});

describe("AudioPlaybackService", () => {
	// Happy: audio disabled — no spawn, resolves
	it("resolves without spawning when disableAudio is true", async () => {
		const svc = new AudioPlaybackService({ disableAudio: true, delayMs: 10 });
		await svc.play(1);
		expect(mockSpawn).not.toHaveBeenCalled();
	});

	// Happy: MP3 exists → file player called
	it("plays MP3 file when it exists", async () => {
		writeFileSync(join(tempDir, "3.mp3"), Buffer.alloc(0));
		mockSpawn.mockImplementation(() => makeProcess("close") as never);

		await new AudioPlaybackService({ announcementsPath: tempDir, delayMs: 50 }).play(3);

		expect(mockSpawn).toHaveBeenCalledTimes(1);
		expect(["mpg123", "afplay"]).toContain(mockSpawn.mock.calls[0][0]);
	});

	// Happy: no MP3 → TTS
	it("uses TTS when no MP3 file exists", async () => {
		mockSpawn.mockImplementation(() => makeProcess("close") as never);

		await new AudioPlaybackService({
			announcementsPath: tempDir,
			enableTtsFallback: true,
			delayMs: 50,
		}).play(7);

		expect(mockSpawn).toHaveBeenCalledTimes(1);
		expect(["espeak-ng", "say"]).toContain(mockSpawn.mock.calls[0][0]);
	});

	// Happy: no MP3 + TTS disabled → silent resolve without spawn
	it("skips announcement without spawning when no MP3 and TTS fallback is disabled", async () => {
		await new AudioPlaybackService({
			announcementsPath: tempDir,
			enableTtsFallback: false,
			delayMs: 20,
		}).play(11);

		expect(mockSpawn).not.toHaveBeenCalled();
	});

	// Sad: MP3 player fails → falls back to TTS
	it("falls back to TTS when MP3 player fails", async () => {
		writeFileSync(join(tempDir, "2.mp3"), Buffer.alloc(0));
		let call = 0;
		mockSpawn.mockImplementation(() => makeProcess(++call === 1 ? "error" : "close") as never);

		await new AudioPlaybackService({
			announcementsPath: tempDir,
			enableTtsFallback: true,
			delayMs: 50,
		}).play(2);

		expect(mockSpawn).toHaveBeenCalledTimes(2);
		expect(["espeak-ng", "say"]).toContain(mockSpawn.mock.calls[1][0]);
	});

	it("falls back to TTS when MP3 player exits non-zero", async () => {
		writeFileSync(join(tempDir, "22.mp3"), Buffer.alloc(0));
		let call = 0;
		mockSpawn.mockImplementation(
			() => (call++ === 0 ? makeProcessWithCloseCode(1) : makeProcess("close")) as never,
		);

		await new AudioPlaybackService({
			announcementsPath: tempDir,
			enableTtsFallback: true,
			delayMs: 50,
		}).play(22);

		expect(mockSpawn).toHaveBeenCalledTimes(2);
		expect(["espeak-ng", "say"]).toContain(mockSpawn.mock.calls[1][0]);
	});

	it("uses mpg123 -a on linux when alsaDevice is provided", async () => {
		writeFileSync(join(tempDir, "5.mp3"), Buffer.alloc(0));
		const platformSpy = vi.spyOn(process, "platform", "get").mockReturnValue("linux");
		mockSpawn.mockImplementation(() => makeProcess("close") as never);

		try {
			await new AudioPlaybackService({
				announcementsPath: tempDir,
				alsaDevice: "plughw:CARD=Headphones,DEV=0",
				delayMs: 50,
			}).play(5);
		} finally {
			platformSpy.mockRestore();
		}

		expect(mockSpawn).toHaveBeenCalledTimes(1);
		expect(mockSpawn.mock.calls[0][0]).toBe("mpg123");
		const args = mockSpawn.mock.calls[0][1] as string[];
		expect(args).toContain("-a");
		expect(args).toContain("plughw:CARD=Headphones,DEV=0");
	});

	it("falls back to TTS when MP3 player hangs and safety timeout kills it", async () => {
		writeFileSync(join(tempDir, "33.mp3"), Buffer.alloc(0));
		const hangingProc = makeHangingProcess();
		let call = 0;
		mockSpawn.mockImplementation(
			() => (call++ === 0 ? hangingProc : makeProcess("close")) as never,
		);
		vi.useFakeTimers();

		try {
			const playPromise = new AudioPlaybackService({
				announcementsPath: tempDir,
				enableTtsFallback: true,
				delayMs: 20,
			}).play(33);

			await vi.advanceTimersByTimeAsync(5200);
			await playPromise;
		} finally {
			vi.useRealTimers();
		}

		expect(hangingProc.kill).toHaveBeenCalledTimes(1);
		expect(mockSpawn).toHaveBeenCalledTimes(2);
		expect(["espeak-ng", "say"]).toContain(mockSpawn.mock.calls[1][0]);
	});

	it("does not spawn TTS when MP3 player exits non-zero and TTS fallback is disabled", async () => {
		writeFileSync(join(tempDir, "44.mp3"), Buffer.alloc(0));
		mockSpawn.mockImplementation(() => makeProcessWithCloseCode(1) as never);

		await expect(
			new AudioPlaybackService({
				announcementsPath: tempDir,
				enableTtsFallback: false,
				delayMs: 20,
			}).play(44),
		).resolves.toBeUndefined();

		expect(mockSpawn).toHaveBeenCalledTimes(1);
	});

	// Critical: both MP3 and TTS fail → silent timer, never throws
	it("resolves via silent timer when both MP3 and TTS fail", async () => {
		mockSpawn.mockImplementation(() => makeProcess("error") as never);

		await expect(
			new AudioPlaybackService({
				announcementsPath: tempDir,
				enableTtsFallback: true,
				delayMs: 20,
			}).play(9),
		).resolves.toBeUndefined();
	});
});
