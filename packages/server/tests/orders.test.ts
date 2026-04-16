import { OrderStatus } from "@sepetarasi/shared";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { AppDatabase } from "../src/db/connection.js";
import { announcementQueue, orderEvents, orders, terminals } from "../src/db/schema.js";
import { createTestDb } from "../src/db/test-utils.js";
import {
	InvalidOrderInputError,
	InvalidTransitionError,
	OrderNotFoundError,
	OrderService,
} from "../src/services/order.service.js";
import { StatsService } from "../src/services/stats.service.js";
import { buildCreateOrderInput } from "./auth-helpers.js";

let db: AppDatabase;
let orderService: OrderService;
let statsService: StatsService;

beforeEach(() => {
	db = createTestDb();
	orderService = new OrderService(db);
	statsService = new StatsService(db);

	// Seed a terminal
	db.insert(terminals).values({ id: "t-1", name: "Kasa 1", type: "kasa", is_active: 1 }).run();
});

describe("Order creation", () => {
	it("should create an order with items and auto-increment display_no", () => {
		const order1 = orderService.create(
			buildCreateOrderInput({
				terminal_id: "t-1",
				items: [{ name: "Doner", quantity: 1, unit_price: 15000 }],
			}),
		);

		expect(order1.display_no).toBe(1);
		expect(order1.status).toBe(OrderStatus.PREPARING);
		expect(order1.items).toHaveLength(1);
		expect(order1.items?.[0].name).toBe("Doner");

		const order2 = orderService.create(
			buildCreateOrderInput({
				customer_name: "Ayşe",
				order_type: "Masada",
				items: [{ name: "Ayran", quantity: 2, unit_price: 3000 }],
			}),
		);
		expect(order2.display_no).toBe(2);

		const order3 = orderService.create(
			buildCreateOrderInput({
				customer_name: "Fatma",
				items: [{ name: "Lahmacun", quantity: 1, unit_price: 12000 }],
			}),
		);
		expect(order3.display_no).toBe(3);
	});

	it("should store customer_name, order_type, target_minutes", () => {
		const order = orderService.create({
			customer_name: "Ali",
			order_type: "Paket",
			target_minutes: 15,
			items: [],
		});

		expect(order.customer_name).toBe("Ali");
		expect(order.order_type).toBe("Paket");
		expect(order.target_minutes).toBe(15);
	});

	it("should require customer_name and order_type", () => {
		expect(() => {
			orderService.create({ customer_name: "", order_type: "Paket", items: [] });
		}).toThrow(InvalidOrderInputError);

		expect(() => {
			orderService.create({ customer_name: "Ali", order_type: "TakeAway" as "Paket", items: [] });
		}).toThrow(InvalidOrderInputError);
	});

	it("should reject customer_name that is only whitespace", () => {
		expect(() => {
			orderService.create({ customer_name: "   ", order_type: "Paket", items: [] });
		}).toThrow(InvalidOrderInputError);
	});

	it("should trim notes and omit when blank after trimming", () => {
		const withSpacesNotes = orderService.create(
			buildCreateOrderInput({ customer_name: "Ali", notes: "  extra not  " }),
		);
		expect(withSpacesNotes.notes).toBe("extra not");

		const withBlankNotes = orderService.create(
			buildCreateOrderInput({ customer_name: "Veli", notes: "   " }),
		);
		expect(withBlankNotes.notes).toBeNull();
	});

	it("should create an order_event for creation", () => {
		const order = orderService.create(buildCreateOrderInput({ customer_name: "Event Testi" }));

		const events = db.select().from(orderEvents).where(eq(orderEvents.order_id, order.id)).all();
		expect(events).toHaveLength(1);
		expect(events[0].from_status).toBeNull();
		expect(events[0].to_status).toBe(OrderStatus.PREPARING);
	});

	it("should auto-create terminal when terminal_id does not exist", () => {
		const order = orderService.create(
			buildCreateOrderInput({
				terminal_id: "KASA-1",
				items: [{ name: "Pizza", quantity: 1, unit_price: 20000 }],
			}),
		);

		expect(order.terminal_id).toBe("KASA-1");

		const terminal = db.select().from(terminals).where(eq(terminals.id, "KASA-1")).get();
		expect(terminal).toBeDefined();
		expect(terminal?.type).toBe("kasa");
		expect(terminal?.is_active).toBe(1);
	});
});

describe("Order listing", () => {
	it("should list orders for today", () => {
		orderService.create(buildCreateOrderInput({ customer_name: "Liste A" }));
		orderService.create(buildCreateOrderInput({ customer_name: "Liste B", order_type: "Masada" }));

		const list = orderService.list();
		expect(list).toHaveLength(2);
		// Should be ordered by display_no desc
		expect(list[0].display_no).toBe(2);
		expect(list[1].display_no).toBe(1);
	});

	it("should include items in listing", () => {
		orderService.create({
			customer_name: "İtemli Sipariş",
			order_type: "Paket",
			items: [
				{ name: "A", quantity: 1, unit_price: 1000 },
				{ name: "B", quantity: 2, unit_price: 2000 },
			],
		});

		const list = orderService.list();
		expect(list[0].items).toHaveLength(2);
	});
});

describe("Status transitions - happy path", () => {
	it("should transition PREPARING -> READY -> DELIVERED with correct timestamps", () => {
		const order = orderService.create(buildCreateOrderInput({ customer_name: "Hazırlık Akışı" }));

		// PREPARING -> READY
		const ready = orderService.changeStatus(order.id, { status: OrderStatus.READY });
		expect(ready.status).toBe(OrderStatus.READY);
		expect(ready.ready_at).not.toBeNull();

		// READY -> DELIVERED
		const delivered = orderService.changeStatus(order.id, { status: OrderStatus.DELIVERED });
		expect(delivered.status).toBe(OrderStatus.DELIVERED);
		expect(delivered.delivered_at).not.toBeNull();
		// ready_at should still be set
		expect(delivered.ready_at).not.toBeNull();
	});

	it("should create order_events for each transition", () => {
		const order = orderService.create(buildCreateOrderInput({ customer_name: "Event Akışı" }));

		orderService.changeStatus(order.id, { status: OrderStatus.READY });
		orderService.changeStatus(order.id, { status: OrderStatus.DELIVERED });

		const events = db.select().from(orderEvents).where(eq(orderEvents.order_id, order.id)).all();
		// creation + READY + DELIVERED = 3
		expect(events).toHaveLength(3);
		expect(events[0].to_status).toBe(OrderStatus.PREPARING);
		expect(events[1].from_status).toBe(OrderStatus.PREPARING);
		expect(events[1].to_status).toBe(OrderStatus.READY);
		expect(events[2].from_status).toBe(OrderStatus.READY);
		expect(events[2].to_status).toBe(OrderStatus.DELIVERED);
	});

	it("should allow PREPARING -> CANCELLED", () => {
		const order = orderService.create(buildCreateOrderInput({ customer_name: "İptal Akışı" }));

		const cancelled = orderService.changeStatus(order.id, { status: OrderStatus.CANCELLED });
		expect(cancelled.status).toBe(OrderStatus.CANCELLED);
		expect(cancelled.cancelled_at).not.toBeNull();
	});

	it("should allow READY -> PREPARING (undo)", () => {
		const order = orderService.create(buildCreateOrderInput({ customer_name: "Undo Akışı" }));

		orderService.changeStatus(order.id, { status: OrderStatus.READY });
		const undone = orderService.changeStatus(order.id, { status: OrderStatus.PREPARING });
		expect(undone.status).toBe(OrderStatus.PREPARING);
		expect(undone.ready_at).toBeNull();
	});
});

describe("Status transitions - sad path", () => {
	it("should reject PREPARING -> DELIVERED", () => {
		const order = orderService.create(buildCreateOrderInput({ customer_name: "Sad Path 1" }));

		expect(() => {
			orderService.changeStatus(order.id, { status: OrderStatus.DELIVERED });
		}).toThrow(InvalidTransitionError);
	});

	it("should reject CANCELLED -> any status", () => {
		const order = orderService.create(buildCreateOrderInput({ customer_name: "Sad Path 2" }));

		orderService.changeStatus(order.id, { status: OrderStatus.CANCELLED });

		for (const status of [OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.DELIVERED]) {
			expect(() => {
				orderService.changeStatus(order.id, { status });
			}).toThrow(InvalidTransitionError);
		}
	});

	it("should reject DELIVERED -> any status", () => {
		const order = orderService.create(buildCreateOrderInput({ customer_name: "Sad Path 3" }));

		orderService.changeStatus(order.id, { status: OrderStatus.READY });
		orderService.changeStatus(order.id, { status: OrderStatus.DELIVERED });

		for (const status of [OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.CANCELLED]) {
			expect(() => {
				orderService.changeStatus(order.id, { status });
			}).toThrow(InvalidTransitionError);
		}
	});

	it("should throw OrderNotFoundError for non-existent order", () => {
		expect(() => {
			orderService.changeStatus("non-existent", { status: OrderStatus.READY });
		}).toThrow(OrderNotFoundError);
	});
});

describe("READY atomic transaction", () => {
	it("should insert announcement_queue record when transitioning to READY", () => {
		const order = orderService.create(buildCreateOrderInput({ customer_name: "Queue Testi" }));

		orderService.changeStatus(order.id, { status: OrderStatus.READY });

		const queue = db.select().from(announcementQueue).all();
		expect(queue).toHaveLength(1);
		expect(queue[0].order_id).toBe(order.id);
		expect(queue[0].display_no).toBe(order.display_no);
		expect(queue[0].type).toBe("ready");
		expect(queue[0].status).toBe("pending");
	});

	it("should be idempotent: setting READY twice creates only one announcement", () => {
		const order = orderService.create(buildCreateOrderInput({ customer_name: "Queue Undo" }));

		orderService.changeStatus(order.id, { status: OrderStatus.READY });

		// Undo then re-READY
		orderService.changeStatus(order.id, { status: OrderStatus.PREPARING });
		orderService.changeStatus(order.id, { status: OrderStatus.READY });

		// Should have exactly one announcement (the second one, since undo deletes the first)
		const queue = db.select().from(announcementQueue).all();
		expect(queue).toHaveLength(1);
	});

	it("should delete announcement_queue when undoing READY -> PREPARING", () => {
		const order = orderService.create(buildCreateOrderInput({ customer_name: "Queue Delete" }));

		orderService.changeStatus(order.id, { status: OrderStatus.READY });
		expect(db.select().from(announcementQueue).all()).toHaveLength(1);

		orderService.changeStatus(order.id, { status: OrderStatus.PREPARING });
		expect(db.select().from(announcementQueue).all()).toHaveLength(0);
	});
});

describe("Stats", () => {
	it("should calculate averagePrepMinutes correctly", () => {
		const today = new Date().toISOString().slice(0, 10);

		// Manually insert orders with known timestamps for predictable results
		const now = Date.now();
		const fiveMinAgo = new Date(now - 5 * 60 * 1000).toISOString();
		const tenMinAgo = new Date(now - 10 * 60 * 1000).toISOString();
		const readyTime = new Date(now).toISOString();

		db.insert(orders)
			.values({
				id: "o-1",
				business_date: today,
				display_no: 1,
				status: "READY",
				created_at: tenMinAgo,
				updated_at: readyTime,
				ready_at: readyTime,
			})
			.run();

		db.insert(orders)
			.values({
				id: "o-2",
				business_date: today,
				display_no: 2,
				status: "READY",
				created_at: fiveMinAgo,
				updated_at: readyTime,
				ready_at: readyTime,
			})
			.run();

		// Still preparing
		db.insert(orders)
			.values({
				id: "o-3",
				business_date: today,
				display_no: 3,
				status: "PREPARING",
				created_at: readyTime,
				updated_at: readyTime,
			})
			.run();

		const stats = statsService.getToday(today);
		expect(stats.totalOrders).toBe(3);
		expect(stats.byStatus[OrderStatus.READY]).toBe(2);
		expect(stats.byStatus[OrderStatus.PREPARING]).toBe(1);
		// Average of ~10 min and ~5 min = ~7.5 min
		expect(stats.averagePrepMinutes).not.toBeNull();
		expect(stats.averagePrepMinutes!).toBeGreaterThan(5);
		expect(stats.averagePrepMinutes!).toBeLessThan(10);
		expect(stats.averageDeliverySeconds).toBeNull();
	});

	it("should calculate averageDeliverySeconds only from delivered orders", () => {
		const today = new Date().toISOString().slice(0, 10);
		const now = Date.now();
		const fiveMinAgo = new Date(now - 5 * 60 * 1000).toISOString();
		const tenMinAgo = new Date(now - 10 * 60 * 1000).toISOString();
		const deliveredTime = new Date(now).toISOString();

		db.insert(orders)
			.values([
				{
					id: "o-delivered-1",
					business_date: today,
					display_no: 1,
					status: "DELIVERED",
					created_at: tenMinAgo,
					updated_at: deliveredTime,
					delivered_at: deliveredTime,
				},
				{
					id: "o-delivered-2",
					business_date: today,
					display_no: 2,
					status: "DELIVERED",
					created_at: fiveMinAgo,
					updated_at: deliveredTime,
					delivered_at: deliveredTime,
				},
				{
					id: "o-ready",
					business_date: today,
					display_no: 3,
					status: "READY",
					created_at: deliveredTime,
					updated_at: deliveredTime,
					ready_at: deliveredTime,
				},
			])
			.run();

		const stats = statsService.getToday(today);
		expect(stats.averageDeliverySeconds).toBe(450);
	});

	it("should exclude cancelled orders from totalOrders but keep cancelled status count", () => {
		const today = new Date().toISOString().slice(0, 10);
		const now = new Date().toISOString();

		db.insert(orders)
			.values([
				{
					id: "o-active",
					business_date: today,
					display_no: 1,
					status: "PREPARING",
					created_at: now,
					updated_at: now,
				},
				{
					id: "o-cancelled",
					business_date: today,
					display_no: 2,
					status: "CANCELLED",
					created_at: now,
					updated_at: now,
					cancelled_at: now,
				},
			])
			.run();

		const stats = statsService.getToday(today);
		expect(stats.totalOrders).toBe(1);
		expect(stats.byStatus[OrderStatus.PREPARING]).toBe(1);
		expect(stats.byStatus[OrderStatus.CANCELLED]).toBe(1);
	});

	it("should exclude cancelled orders from averagePrepMinutes even if ready_at exists", () => {
		const today = new Date().toISOString().slice(0, 10);
		const now = Date.now();
		const tenMinAgo = new Date(now - 10 * 60 * 1000).toISOString();
		const thirtyMinAgo = new Date(now - 30 * 60 * 1000).toISOString();
		const currentTime = new Date(now).toISOString();

		db.insert(orders)
			.values([
				{
					id: "o-ready",
					business_date: today,
					display_no: 1,
					status: "READY",
					created_at: tenMinAgo,
					updated_at: currentTime,
					ready_at: currentTime,
				},
				{
					// Simulates READY -> CANCELLED historical row: ready_at is present
					id: "o-cancelled-after-ready",
					business_date: today,
					display_no: 2,
					status: "CANCELLED",
					created_at: thirtyMinAgo,
					updated_at: currentTime,
					ready_at: currentTime,
					cancelled_at: currentTime,
				},
			])
			.run();

		const stats = statsService.getToday(today);
		expect(stats.averagePrepMinutes).not.toBeNull();
		expect(stats.averagePrepMinutes!).toBeGreaterThan(9);
		expect(stats.averagePrepMinutes!).toBeLessThan(12);
	});

	it("should return null averages when there are no completed orders", () => {
		const stats = statsService.getToday();
		expect(stats.averagePrepMinutes).toBeNull();
		expect(stats.averageDeliverySeconds).toBeNull();
		expect(stats.totalOrders).toBe(0);
	});
});
