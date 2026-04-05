/**
 * Audio playback tests for AnnouncementWorker.
 *
 * Strategy: mock `node:child_process` spawn to control process outcomes.
 * Real temp dirs control file presence — no need to mock node:fs.
 *
 * Invariant under test: regardless of audio outcome (success / ENOENT / hang),
 * the announcement must reach "played" state and the worker must not throw.
 */

import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- child_process mock (hoisted before imports) ---
vi.mock("node:child_process", () => ({ spawn: vi.fn() }));

import { spawn } from "node:child_process";
import type { AppDatabase } from "../src/db/connection.js";
import { announcementQueue, orders } from "../src/db/schema.js";
import { createTestDb } from "../src/db/test-utils.js";
import { AnnouncementService } from "../src/services/announcement.service.js";
import { AudioPlaybackService } from "../src/services/audio-playback.service.js";
import { AnnouncementWorker } from "../src/workers/announcement.worker.js";
import { Broadcaster } from "../src/ws/broadcaster.js";

const mockSpawn = vi.mocked(spawn);

// Helpers to build minimal EventEmitter-based process mocks

function makeProcess(outcome: "close" | "error", delayMs = 5) {
	const proc = new EventEmitter() as EventEmitter & { kill: () => void };
	proc.kill = vi.fn();
	setTimeout(() => {
		if (outcome === "close") proc.emit("close", 0);
		else proc.emit("error", Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" }));
	}, delayMs);
	return proc;
}

// ---

let db: AppDatabase;
let service: AnnouncementService;
let broadcaster: Broadcaster;
let tempDir: string;

beforeEach(() => {
	db = createTestDb();
	service = new AnnouncementService(db);
	broadcaster = new Broadcaster();
	tempDir = mkdtempSync(join(tmpdir(), "sepetarasi-audio-"));
	mockSpawn.mockClear();
});

afterEach(() => {
	rmSync(tempDir, { recursive: true, force: true });
});

function seedPendingAnnouncement(orderId: string, displayNo: number) {
	db.insert(orders)
		.values({ id: orderId, business_date: "2026-04-04", display_no: displayNo, status: "READY" })
		.run();
	db.insert(announcementQueue)
		.values({
			id: `aq-${displayNo}`,
			order_id: orderId,
			display_no: displayNo,
			type: "ready",
			status: "pending",
			enqueued_at: new Date().toISOString(),
		})
		.run();
}

function makeWorker(
	opts: { announcementsPath?: string; delayMs?: number; enableTtsFallback?: boolean } = {},
) {
	const audioPlayer = new AudioPlaybackService({
		disableAudio: false,
		enableTtsFallback: opts.enableTtsFallback ?? false,
		announcementsPath: opts.announcementsPath ?? tempDir,
		delayMs: opts.delayMs ?? 50,
	});
	return new AnnouncementWorker({
		announcementService: service,
		broadcaster,
		audioPlayer,
		pollIntervalMs: 50,
	});
}

// ─────────────────────────────────────────────
// Happy paths
// ─────────────────────────────────────────────

describe("AnnouncementWorker — audio happy paths", () => {
	it("no mp3 file + TTS disabled → no spawn and announcement reaches played", async () => {
		seedPendingAnnouncement("o-1", 10);

		await makeWorker({ enableTtsFallback: false }).processOne();

		const item = db
			.select()
			.from(announcementQueue)
			.where(eq(announcementQueue.id, "aq-10"))
			.get()!;
		expect(item.status).toBe("played");
		expect(mockSpawn).not.toHaveBeenCalled();
	});

	it("no mp3 file → TTS spawn called → announcement reaches played", async () => {
		// tempDir is empty, so no .mp3 file exists → falls through to TTS
		mockSpawn.mockImplementation(() => makeProcess("close") as never);
		seedPendingAnnouncement("o-1", 1);

		await makeWorker({ enableTtsFallback: true }).processOne();

		const item = db.select().from(announcementQueue).where(eq(announcementQueue.id, "aq-1")).get()!;
		expect(item.status).toBe("played");

		// One spawn call: TTS (espeak-ng or say)
		expect(mockSpawn).toHaveBeenCalledTimes(1);
		const cmd = mockSpawn.mock.calls[0][0] as string;
		expect(["espeak-ng", "say"]).toContain(cmd);
	});

	it("mp3 file exists → file player (mpg123/afplay) called first", async () => {
		writeFileSync(join(tempDir, "5.mp3"), Buffer.alloc(0)); // dummy file
		mockSpawn.mockImplementation(() => makeProcess("close") as never);
		seedPendingAnnouncement("o-1", 5);

		await makeWorker().processOne();

		const item = db.select().from(announcementQueue).where(eq(announcementQueue.id, "aq-5")).get()!;
		expect(item.status).toBe("played");

		// First spawn must be the file player, not TTS
		const firstCmd = mockSpawn.mock.calls[0][0] as string;
		expect(["mpg123", "afplay"]).toContain(firstCmd);

		// Only one spawn: file player succeeded, TTS not needed
		expect(mockSpawn).toHaveBeenCalledTimes(1);
	});

	it("TTS text contains the correct display number", async () => {
		mockSpawn.mockImplementation(() => makeProcess("close") as never);
		seedPendingAnnouncement("o-1", 42);

		await makeWorker({ enableTtsFallback: true }).processOne();

		// Args passed to TTS must include the order number text
		const args = mockSpawn.mock.calls[0][1] as string[];
		const fullArgs = args.join(" ");
		expect(fullArgs).toContain("42");
	});
});

// ─────────────────────────────────────────────
// Sad paths — fallback chain & resilience
// ─────────────────────────────────────────────

describe("AnnouncementWorker — audio sad paths", () => {
	it("file player ENOENT → falls back to TTS → announcement reaches played", async () => {
		writeFileSync(join(tempDir, "3.mp3"), Buffer.alloc(0));

		let callCount = 0;
		mockSpawn.mockImplementation(() => {
			callCount++;
			// First call (mpg123/afplay) fails; second call (TTS) succeeds
			return makeProcess(callCount === 1 ? "error" : "close") as never;
		});

		seedPendingAnnouncement("o-1", 3);
		await makeWorker({ enableTtsFallback: true }).processOne();

		// Two spawns: file player attempted then TTS
		expect(mockSpawn).toHaveBeenCalledTimes(2);
		const first = mockSpawn.mock.calls[0][0] as string;
		const second = mockSpawn.mock.calls[1][0] as string;
		expect(["mpg123", "afplay"]).toContain(first);
		expect(["espeak-ng", "say"]).toContain(second);

		const item = db.select().from(announcementQueue).where(eq(announcementQueue.id, "aq-3")).get()!;
		expect(item.status).toBe("played");
	});

	it("both spawns fail (ENOENT) → silent timer fallback → announcement reaches played", async () => {
		// No file in tempDir (direct TTS path), TTS command also fails
		mockSpawn.mockImplementation(() => makeProcess("error") as never);
		seedPendingAnnouncement("o-1", 7);

		await makeWorker({ delayMs: 20, enableTtsFallback: true }).processOne();

		// Worker must not throw; announcement must still be played
		const item = db.select().from(announcementQueue).where(eq(announcementQueue.id, "aq-7")).get()!;
		expect(item.status).toBe("played");
	});

	it("spawn hangs indefinitely → safety timeout kills process → announcement reaches played", async () => {
		// Process that never emits close or error (hangs)
		const hangingProc = new EventEmitter() as EventEmitter & { kill: () => void };
		hangingProc.kill = vi.fn();
		mockSpawn.mockImplementation(() => hangingProc as never);

		seedPendingAnnouncement("o-1", 8);

		// delayMs=20 → safety timeout = 20+5000ms — too long to wait in test.
		// Use a very small delayMs so safety timeout fires quickly.
		await makeWorker({ delayMs: 30, enableTtsFallback: true }).processOne();

		expect(hangingProc.kill).toHaveBeenCalled();

		const item = db.select().from(announcementQueue).where(eq(announcementQueue.id, "aq-8")).get()!;
		expect(item.status).toBe("played");
	}, 10_000); // allow up to 10s for safety timeout
});
