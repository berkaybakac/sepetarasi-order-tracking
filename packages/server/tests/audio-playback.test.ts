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

		await new AudioPlaybackService({ announcementsPath: tempDir, delayMs: 50 }).play(7);

		expect(mockSpawn).toHaveBeenCalledTimes(1);
		expect(["espeak-ng", "say"]).toContain(mockSpawn.mock.calls[0][0]);
	});

	// Sad: MP3 player fails → falls back to TTS
	it("falls back to TTS when MP3 player fails", async () => {
		writeFileSync(join(tempDir, "2.mp3"), Buffer.alloc(0));
		let call = 0;
		mockSpawn.mockImplementation(() => makeProcess(++call === 1 ? "error" : "close") as never);

		await new AudioPlaybackService({ announcementsPath: tempDir, delayMs: 50 }).play(2);

		expect(mockSpawn).toHaveBeenCalledTimes(2);
		expect(["espeak-ng", "say"]).toContain(mockSpawn.mock.calls[1][0]);
	});

	// Critical: both MP3 and TTS fail → silent timer, never throws
	it("resolves via silent timer when both MP3 and TTS fail", async () => {
		mockSpawn.mockImplementation(() => makeProcess("error") as never);

		await expect(
			new AudioPlaybackService({ announcementsPath: tempDir, delayMs: 20 }).play(9),
		).resolves.toBeUndefined();
	});
});
