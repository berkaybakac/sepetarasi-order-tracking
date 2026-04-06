import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { AppDatabase } from "../src/db/connection.js";
import { announcementQueue, orders } from "../src/db/schema.js";
import { createTestDb } from "../src/db/test-utils.js";
import { AnnouncementService } from "../src/services/announcement.service.js";
import { AudioPlaybackService } from "../src/services/audio-playback.service.js";
import { AnnouncementWorker } from "../src/workers/announcement.worker.js";
import { Broadcaster } from "../src/ws/broadcaster.js";

let db: AppDatabase;
let announcementService: AnnouncementService;
let broadcaster: Broadcaster;
let worker: AnnouncementWorker;

beforeEach(() => {
	db = createTestDb();
	announcementService = new AnnouncementService(db);
	broadcaster = new Broadcaster();
	const audioPlayer = new AudioPlaybackService({ disableAudio: true, delayMs: 10 });
	worker = new AnnouncementWorker({
		announcementService,
		broadcaster,
		audioPlayer,
		pollIntervalMs: 50,
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
		expect(next?.id).toBe("aq-1"); // First in, first out
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

describe("AnnouncementService.resetStuckAnnouncements()", () => {
	it("resets playing announcements to pending", () => {
		seedOrder("o-1", 1);
		db.insert(announcementQueue)
			.values({
				id: "aq-1",
				order_id: "o-1",
				display_no: 1,
				type: "ready",
				status: "playing",
				enqueued_at: new Date().toISOString(),
			})
			.run();

		announcementService.resetStuckAnnouncements();

		const item = db.select().from(announcementQueue).where(eq(announcementQueue.id, "aq-1")).get()!;
		expect(item.status).toBe("pending");
	});

	it("does not touch pending or played announcements", () => {
		seedOrder("o-1", 1);
		seedOrder("o-2", 2);
		seedOrder("o-3", 3);

		db.insert(announcementQueue)
			.values([
				{
					id: "aq-1",
					order_id: "o-1",
					display_no: 1,
					type: "ready",
					status: "pending",
					enqueued_at: new Date().toISOString(),
				},
				{
					id: "aq-2",
					order_id: "o-2",
					display_no: 2,
					type: "ready",
					status: "played",
					enqueued_at: new Date().toISOString(),
				},
				{
					id: "aq-3",
					order_id: "o-3",
					display_no: 3,
					type: "ready",
					status: "playing",
					enqueued_at: new Date().toISOString(),
				},
			])
			.run();

		announcementService.resetStuckAnnouncements();

		const items = db.select().from(announcementQueue).all();
		const byId = Object.fromEntries(items.map((i) => [i.id, i.status]));
		expect(byId["aq-1"]).toBe("pending"); // unchanged
		expect(byId["aq-2"]).toBe("played"); // unchanged
		expect(byId["aq-3"]).toBe("pending"); // was playing → reset
	});

	it("is a no-op when no stuck announcements exist", () => {
		seedOrder("o-1", 1);
		seedAnnouncement("aq-1", "o-1", 1); // status: pending

		announcementService.resetStuckAnnouncements();

		const item = db.select().from(announcementQueue).where(eq(announcementQueue.id, "aq-1")).get()!;
		expect(item.status).toBe("pending");
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
		const first = db
			.select()
			.from(announcementQueue)
			.where(eq(announcementQueue.id, "aq-1"))
			.get()!;
		expect(first.status).toBe("played");

		const second = db
			.select()
			.from(announcementQueue)
			.where(eq(announcementQueue.id, "aq-2"))
			.get()!;
		expect(second.status).toBe("pending");

		// Process second
		await worker.processOne();
		const secondAfter = db
			.select()
			.from(announcementQueue)
			.where(eq(announcementQueue.id, "aq-2"))
			.get()!;
		expect(secondAfter.status).toBe("played");
	});

	it("should do nothing when queue is empty", async () => {
		// Should not throw
		await worker.processOne();
	});
});
