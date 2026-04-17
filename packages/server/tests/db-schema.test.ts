import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { AppDatabase } from "../src/db/connection.js";
import {
	announcementQueue,
	appSettings,
	orderEvents,
	orderItems,
	orders,
	terminals,
} from "../src/db/schema.js";
import { createTestDb } from "../src/db/test-utils.js";

let db: AppDatabase;

beforeEach(() => {
	db = createTestDb();
});

describe("Migration", () => {
	it("should create all 6 tables", () => {
		// If we can insert into each table, migration worked
		const terminalId = "t-1";
		db.insert(terminals)
			.values({ id: terminalId, name: "Kasa 1", type: "kasa", is_active: 1 })
			.run();

		const orderId = "o-1";
		db.insert(orders)
			.values({
				id: orderId,
				business_date: "2026-04-03",
				display_no: 1,
				status: "PREPARING",
				terminal_id: terminalId,
			})
			.run();

		db.insert(orderItems)
			.values({ id: "oi-1", order_id: orderId, name: "Doner", quantity: 1, unit_price: 15000 })
			.run();

		db.insert(orderEvents)
			.values({ id: "oe-1", order_id: orderId, from_status: null, to_status: "PREPARING" })
			.run();

		db.insert(appSettings).values({ key: "test_key", value: "test_value" }).run();

		db.insert(announcementQueue)
			.values({ id: "aq-1", order_id: orderId, display_no: 1, type: "ready", status: "pending" })
			.run();

		// Verify all inserts
		const allOrders = db.select().from(orders).all();
		expect(allOrders).toHaveLength(1);

		const allItems = db.select().from(orderItems).all();
		expect(allItems).toHaveLength(1);

		const allEvents = db.select().from(orderEvents).all();
		expect(allEvents).toHaveLength(1);

		const allTerminals = db.select().from(terminals).all();
		expect(allTerminals).toHaveLength(1);

		const allSettings = db.select().from(appSettings).all();
		expect(allSettings).toHaveLength(5); // audio_volume + music_volume + music_enabled + delivery_target_minutes (seeded) + test_key

		const allAnnouncements = db.select().from(announcementQueue).all();
		expect(allAnnouncements).toHaveLength(1);
	});
});

describe("UNIQUE constraints", () => {
	it("should enforce UNIQUE(business_date, display_no) on orders", () => {
		db.insert(terminals).values({ id: "t-1", name: "Kasa 1" }).run();
		db.insert(orders)
			.values({
				id: "o-1",
				business_date: "2026-04-03",
				display_no: 1,
				status: "PREPARING",
			})
			.run();

		expect(() => {
			db.insert(orders)
				.values({
					id: "o-2",
					business_date: "2026-04-03",
					display_no: 1,
					status: "PREPARING",
				})
				.run();
		}).toThrow();
	});

	it("should allow same display_no on different business_date", () => {
		db.insert(orders).values({ id: "o-1", business_date: "2026-04-03", display_no: 1 }).run();

		db.insert(orders).values({ id: "o-2", business_date: "2026-04-04", display_no: 1 }).run();

		const allOrders = db.select().from(orders).all();
		expect(allOrders).toHaveLength(2);
	});

	it("should enforce UNIQUE(order_id, type) on announcement_queue (idempotency)", () => {
		db.insert(orders).values({ id: "o-1", business_date: "2026-04-03", display_no: 1 }).run();

		db.insert(announcementQueue)
			.values({ id: "aq-1", order_id: "o-1", display_no: 1, type: "ready", status: "pending" })
			.run();

		expect(() => {
			db.insert(announcementQueue)
				.values({ id: "aq-2", order_id: "o-1", display_no: 1, type: "ready", status: "pending" })
				.run();
		}).toThrow();
	});

	it("should allow INSERT OR IGNORE for idempotent announcement enqueue", () => {
		db.insert(orders).values({ id: "o-1", business_date: "2026-04-03", display_no: 1 }).run();

		db.insert(announcementQueue)
			.values({ id: "aq-1", order_id: "o-1", display_no: 1, type: "ready", status: "pending" })
			.run();

		// Second insert with onConflictDoNothing should not throw
		db.insert(announcementQueue)
			.values({ id: "aq-2", order_id: "o-1", display_no: 1, type: "ready", status: "pending" })
			.onConflictDoNothing()
			.run();

		const items = db.select().from(announcementQueue).all();
		expect(items).toHaveLength(1);
		expect(items[0].id).toBe("aq-1");
	});
});

describe("FK CASCADE delete", () => {
	it("should cascade delete order_items when order is deleted", () => {
		db.insert(orders).values({ id: "o-1", business_date: "2026-04-03", display_no: 1 }).run();

		db.insert(orderItems)
			.values({ id: "oi-1", order_id: "o-1", name: "Doner", quantity: 1, unit_price: 15000 })
			.run();

		db.insert(orderItems)
			.values({ id: "oi-2", order_id: "o-1", name: "Ayran", quantity: 2, unit_price: 3000 })
			.run();

		// Delete the order
		db.delete(orders).where(eq(orders.id, "o-1")).run();

		const items = db.select().from(orderItems).all();
		expect(items).toHaveLength(0);
	});

	it("should cascade delete order_events when order is deleted", () => {
		db.insert(orders).values({ id: "o-1", business_date: "2026-04-03", display_no: 1 }).run();

		db.insert(orderEvents)
			.values({ id: "oe-1", order_id: "o-1", from_status: null, to_status: "PREPARING" })
			.run();

		db.delete(orders).where(eq(orders.id, "o-1")).run();

		const events = db.select().from(orderEvents).all();
		expect(events).toHaveLength(0);
	});

	it("should cascade delete announcement_queue when order is deleted", () => {
		db.insert(orders).values({ id: "o-1", business_date: "2026-04-03", display_no: 1 }).run();

		db.insert(announcementQueue)
			.values({ id: "aq-1", order_id: "o-1", display_no: 1, type: "ready", status: "pending" })
			.run();

		db.delete(orders).where(eq(orders.id, "o-1")).run();

		const queue = db.select().from(announcementQueue).all();
		expect(queue).toHaveLength(0);
	});
});

describe("Default values", () => {
	it("should default order status to PREPARING", () => {
		db.insert(orders).values({ id: "o-1", business_date: "2026-04-03", display_no: 1 }).run();

		const [order] = db.select().from(orders).where(eq(orders.id, "o-1")).all();
		expect(order.status).toBe("PREPARING");
	});

	it("should default terminal type to kasa", () => {
		db.insert(terminals).values({ id: "t-1", name: "Test Terminal" }).run();

		const [terminal] = db.select().from(terminals).where(eq(terminals.id, "t-1")).all();
		expect(terminal.type).toBe("kasa");
	});

	it("should default announcement_queue status to pending", () => {
		db.insert(orders).values({ id: "o-1", business_date: "2026-04-03", display_no: 1 }).run();

		db.insert(announcementQueue).values({ id: "aq-1", order_id: "o-1", display_no: 1 }).run();

		const [aq] = db.select().from(announcementQueue).where(eq(announcementQueue.id, "aq-1")).all();
		expect(aq.status).toBe("pending");
		expect(aq.type).toBe("ready");
	});
});
