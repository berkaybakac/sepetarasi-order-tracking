import { OrderStatus } from "@sepetarasi/shared";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { AppDatabase } from "../src/db/connection.js";
import { announcementQueue, orders, terminals } from "../src/db/schema.js";
import { createTestDb } from "../src/db/test-utils.js";
import { AnnouncementService } from "../src/services/announcement.service.js";
import { OrderService } from "../src/services/order.service.js";
import { buildCreateOrderInput } from "./auth-helpers.js";

let db: AppDatabase;
let orderService: OrderService;
let announcementService: AnnouncementService;

beforeEach(() => {
	db = createTestDb();
	orderService = new OrderService(db);
	announcementService = new AnnouncementService(db);
	db.insert(terminals).values({ id: "t-1", name: "Kasa 1", type: "kasa", is_active: 1 }).run();
});

function getAnnouncement(orderId: string) {
	return db
		.select()
		.from(announcementQueue)
		.where(and(eq(announcementQueue.order_id, orderId), eq(announcementQueue.type, "ready")))
		.get();
}

describe("READY -> PREPARING undo: announcement queue behavior", () => {
	it("should DELETE announcement when status is 'pending'", () => {
		const order = orderService.create({
			...buildCreateOrderInput({ customer_name: "Pending Testi" }),
		});

		// PREPARING -> READY: creates pending announcement
		orderService.changeStatus(order.id, { status: OrderStatus.READY });
		const ann = getAnnouncement(order.id);
		expect(ann).toBeDefined();
		expect(ann?.status).toBe("pending");

		// READY -> PREPARING: should delete the pending announcement
		orderService.changeStatus(order.id, { status: OrderStatus.PREPARING });
		const after = getAnnouncement(order.id);
		expect(after).toBeUndefined();
	});

	it("should NOT DELETE announcement when status is 'playing' (worker owns it)", () => {
		const order = orderService.create({
			...buildCreateOrderInput({ customer_name: "Playing Testi" }),
		});

		// PREPARING -> READY
		orderService.changeStatus(order.id, { status: OrderStatus.READY });

		// Simulate worker picking it up: mark as playing
		const ann = getAnnouncement(order.id)!;
		announcementService.markPlaying(ann.id);
		expect(getAnnouncement(order.id)?.status).toBe("playing");

		// READY -> PREPARING: should NOT delete playing announcement
		orderService.changeStatus(order.id, { status: OrderStatus.PREPARING });
		const after = getAnnouncement(order.id);
		expect(after).toBeDefined();
		expect(after?.status).toBe("playing");
	});

	it("should DELETE announcement when status is 'played' (already announced, cleanup)", () => {
		const order = orderService.create({
			...buildCreateOrderInput({ customer_name: "Played Testi" }),
		});

		// PREPARING -> READY
		orderService.changeStatus(order.id, { status: OrderStatus.READY });

		// Simulate worker completing: mark as played
		const ann = getAnnouncement(order.id)!;
		announcementService.markPlaying(ann.id);
		announcementService.markPlayed(ann.id);
		expect(getAnnouncement(order.id)?.status).toBe("played");

		// READY -> PREPARING: should delete played announcement (cleanup)
		orderService.changeStatus(order.id, { status: OrderStatus.PREPARING });
		const after = getAnnouncement(order.id);
		expect(after).toBeUndefined();
	});

	it("should DELETE announcement when status is 'failed'", () => {
		const order = orderService.create({
			...buildCreateOrderInput({ customer_name: "Failed Testi" }),
		});

		// PREPARING -> READY
		orderService.changeStatus(order.id, { status: OrderStatus.READY });

		// Simulate worker failure
		const ann = getAnnouncement(order.id)!;
		announcementService.markFailed(ann.id, "TTS error");
		expect(getAnnouncement(order.id)?.status).toBe("failed");

		// READY -> PREPARING: should delete failed announcement
		orderService.changeStatus(order.id, { status: OrderStatus.PREPARING });
		const after = getAnnouncement(order.id);
		expect(after).toBeUndefined();
	});

	it("should create NEW announcement when re-READY after undo (with pending deleted)", () => {
		const order = orderService.create({
			...buildCreateOrderInput({ customer_name: "Re-Ready Testi" }),
		});

		// READY -> creates announcement
		orderService.changeStatus(order.id, { status: OrderStatus.READY });
		const firstAnn = getAnnouncement(order.id)!;
		const firstId = firstAnn.id;

		// Undo -> deletes announcement
		orderService.changeStatus(order.id, { status: OrderStatus.PREPARING });
		expect(getAnnouncement(order.id)).toBeUndefined();

		// Re-READY -> creates new announcement
		orderService.changeStatus(order.id, { status: OrderStatus.READY });
		const newAnn = getAnnouncement(order.id);
		expect(newAnn).toBeDefined();
		expect(newAnn?.status).toBe("pending");
		expect(newAnn?.id).not.toBe(firstId); // different record
	});

	it("should handle re-READY when playing announcement still exists (idempotent)", () => {
		const order = orderService.create({
			...buildCreateOrderInput({ customer_name: "Idempotent Testi" }),
		});

		// READY -> announcement created
		orderService.changeStatus(order.id, { status: OrderStatus.READY });

		// Worker picks it up -> playing
		const ann = getAnnouncement(order.id)!;
		announcementService.markPlaying(ann.id);

		// Undo -> playing announcement NOT deleted (worker owns it)
		orderService.changeStatus(order.id, { status: OrderStatus.PREPARING });
		expect(getAnnouncement(order.id)?.status).toBe("playing");

		// Re-READY -> INSERT OR IGNORE, should not duplicate
		orderService.changeStatus(order.id, { status: OrderStatus.READY });
		const allForOrder = db
			.select()
			.from(announcementQueue)
			.where(eq(announcementQueue.order_id, order.id))
			.all();
		expect(allForOrder).toHaveLength(1); // still just the one playing record
		expect(allForOrder[0].status).toBe("playing");
	});
});
