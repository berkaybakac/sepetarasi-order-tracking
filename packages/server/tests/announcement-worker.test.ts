import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "../src/db/test-utils.js";
import { AnnouncementService } from "../src/services/announcement.service.js";
import { AnnouncementWorker } from "../src/workers/announcement.worker.js";
import { Broadcaster } from "../src/ws/broadcaster.js";
import { orders, announcementQueue } from "../src/db/schema.js";
import { eq } from "drizzle-orm";
import type { AppDatabase } from "../src/db/connection.js";

let db: AppDatabase;
let announcementService: AnnouncementService;
let broadcaster: Broadcaster;
let worker: AnnouncementWorker;

beforeEach(() => {
	db = createTestDb();
	announcementService = new AnnouncementService(db);
	broadcaster = new Broadcaster();
	worker = new AnnouncementWorker({
		announcementService,
		broadcaster,
		delayMs: 10, // fast for tests
		pollIntervalMs: 50,
		disableAudio: true, // no sound during tests
	});
});

function seedOrder(id: string, displayNo: number) {
	db.insert(orders)
		.values({
			id,
			business_date: "2026-04-03",
			display_no: displayNo,
			status: "READY",
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})
		.run();
}

function seedAnnouncement(id: string, orderId: string, displayNo: number) {
	db.insert(announcementQueue)
		.values({
			id,
			order_id: orderId,
			display_no: displayNo,
			type: "ready",
			status: "pending",
			enqueued_at: new Date().toISOString(),
		})
		.run();
}

describe("AnnouncementService", () => {
	it("should return next pending announcement in FIFO order", () => {
		seedOrder("o-1", 1);
		seedOrder("o-2", 2);

		const earlier = new Date(Date.now() - 1000).toISOString();
		const later = new Date().toISOString();

		db.insert(announcementQueue)
			.values({
				id: "aq-1",
				order_id: "o-1",
				display_no: 1,
				type: "ready",
				status: "pending",
				enqueued_at: earlier,
			})
			.run();

		db.insert(announcementQueue)
			.values({
				id: "aq-2",
				order_id: "o-2",
				display_no: 2,
				type: "ready",
				status: "pending",
				enqueued_at: later,
			})
			.run();

		const next = announcementService.getNextPending();
		expect(next).not.toBeNull();
		expect(next!.id).toBe("aq-1"); // First in, first out
	});

	it("should return null when no pending announcements", () => {
		const next = announcementService.getNextPending();
		expect(next).toBeNull();
	});

	it("should mark announcement as played", () => {
		seedOrder("o-1", 1);
		seedAnnouncement("aq-1", "o-1", 1);

		announcementService.markPlaying("aq-1");
		let item = db.select().from(announcementQueue).where(eq(announcementQueue.id, "aq-1")).get()!;
		expect(item.status).toBe("playing");

		announcementService.markPlayed("aq-1");
		item = db.select().from(announcementQueue).where(eq(announcementQueue.id, "aq-1")).get()!;
		expect(item.status).toBe("played");
		expect(item.played_at).not.toBeNull();
	});

	it("should mark announcement as failed", () => {
		seedOrder("o-1", 1);
		seedAnnouncement("aq-1", "o-1", 1);

		announcementService.markFailed("aq-1", "TTS error");
		const item = db.select().from(announcementQueue).where(eq(announcementQueue.id, "aq-1")).get()!;
		expect(item.status).toBe("failed");
		expect(item.error).toBe("TTS error");
	});
});

describe("AnnouncementWorker", () => {
	it("should process a pending announcement to played", async () => {
		seedOrder("o-1", 1);
		seedAnnouncement("aq-1", "o-1", 1);

		await worker.processOne();

		const item = db.select().from(announcementQueue).where(eq(announcementQueue.id, "aq-1")).get()!;
		expect(item.status).toBe("played");
		expect(item.played_at).not.toBeNull();
	});

	it("should process announcements in FIFO order", async () => {
		seedOrder("o-1", 1);
		seedOrder("o-2", 2);

		const earlier = new Date(Date.now() - 2000).toISOString();
		const later = new Date().toISOString();

		db.insert(announcementQueue)
			.values({
				id: "aq-1",
				order_id: "o-1",
				display_no: 1,
				type: "ready",
				status: "pending",
				enqueued_at: earlier,
			})
			.run();

		db.insert(announcementQueue)
			.values({
				id: "aq-2",
				order_id: "o-2",
				display_no: 2,
				type: "ready",
				status: "pending",
				enqueued_at: later,
			})
			.run();

		// Process first
		await worker.processOne();
		const first = db.select().from(announcementQueue).where(eq(announcementQueue.id, "aq-1")).get()!;
		expect(first.status).toBe("played");

		const second = db.select().from(announcementQueue).where(eq(announcementQueue.id, "aq-2")).get()!;
		expect(second.status).toBe("pending");

		// Process second
		await worker.processOne();
		const secondAfter = db.select().from(announcementQueue).where(eq(announcementQueue.id, "aq-2")).get()!;
		expect(secondAfter.status).toBe("played");
	});

	it("should do nothing when queue is empty", async () => {
		// Should not throw
		await worker.processOne();
	});
});
