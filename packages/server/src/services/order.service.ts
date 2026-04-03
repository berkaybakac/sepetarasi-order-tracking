import { randomUUID } from "node:crypto";
import { eq, and, sql, desc } from "drizzle-orm";
import { OrderStatus, isValidTransition } from "@sepetarasi/shared";
import type { AppDatabase } from "../db/connection.js";
import { orders, orderItems, orderEvents, announcementQueue } from "../db/schema.js";
import type { CreateOrderInput, UpdateStatusInput } from "@sepetarasi/shared";

export class OrderService {
	constructor(private db: AppDatabase) {}

	/** Get today's business_date string (YYYY-MM-DD) */
	private getBusinessDate(): string {
		return new Date().toISOString().slice(0, 10);
	}

	/** Create a new order with items (atomic) */
	create(input: CreateOrderInput) {
		const now = new Date().toISOString();
		const businessDate = this.getBusinessDate();
		const orderId = randomUUID();

		// Everything inside one transaction: display_no read + insert = no race condition
		this.db.transaction((tx) => {
			// Get next display_no inside transaction (SQLite EXCLUSIVE lock prevents races)
			const result = tx
				.select({ maxNo: sql<number>`COALESCE(MAX(${orders.display_no}), 0)` })
				.from(orders)
				.where(eq(orders.business_date, businessDate))
				.get();
			const displayNo = (result?.maxNo ?? 0) + 1;

			tx.insert(orders)
				.values({
					id: orderId,
					business_date: businessDate,
					display_no: displayNo,
					status: OrderStatus.PREPARING,
					terminal_id: input.terminal_id ?? null,
					customer_name: input.customer_name ?? null,
					order_type: input.order_type ?? null,
					target_minutes: input.target_minutes ?? null,
					notes: input.notes ?? null,
					created_at: now,
					updated_at: now,
				})
				.run();

			for (const item of input.items) {
				tx.insert(orderItems)
					.values({
						id: randomUUID(),
						order_id: orderId,
						name: item.name,
						quantity: item.quantity,
						unit_price: item.unit_price,
						notes: item.notes ?? null,
					})
					.run();
			}

			// Creation event
			tx.insert(orderEvents)
				.values({
					id: randomUUID(),
					order_id: orderId,
					from_status: null,
					to_status: OrderStatus.PREPARING,
					terminal_id: input.terminal_id ?? null,
					created_at: now,
				})
				.run();
		});

		return this.getById(orderId)!;
	}

	/** List orders for a business_date, optionally filtered by status */
	list(businessDate?: string, status?: OrderStatus) {
		const date = businessDate ?? this.getBusinessDate();

		const conditions = [eq(orders.business_date, date)];
		if (status) {
			conditions.push(eq(orders.status, status));
		}

		const orderRows = this.db
			.select()
			.from(orders)
			.where(and(...conditions))
			.orderBy(desc(orders.display_no))
			.all();

		// Attach items to each order
		return orderRows.map((order) => {
			const items = this.db
				.select()
				.from(orderItems)
				.where(eq(orderItems.order_id, order.id))
				.all();
			return { ...order, items };
		});
	}

	/** Get single order by ID with items and events */
	getById(id: string) {
		const order = this.db.select().from(orders).where(eq(orders.id, id)).get();
		if (!order) return null;

		const items = this.db
			.select()
			.from(orderItems)
			.where(eq(orderItems.order_id, id))
			.all();

		const events = this.db
			.select()
			.from(orderEvents)
			.where(eq(orderEvents.order_id, id))
			.all();

		return { ...order, items, events };
	}

	/**
	 * Change order status (atomic transaction).
	 * For READY: also inserts announcement_queue record.
	 * For READY->PREPARING (undo): deletes announcement_queue record.
	 * Returns the updated order or throws on invalid transition.
	 */
	changeStatus(orderId: string, input: UpdateStatusInput) {
		const order = this.db.select().from(orders).where(eq(orders.id, orderId)).get();
		if (!order) {
			throw new OrderNotFoundError(orderId);
		}

		const fromStatus = order.status as OrderStatus;
		const toStatus = input.status;

		if (!isValidTransition(fromStatus, toStatus)) {
			throw new InvalidTransitionError(fromStatus, toStatus);
		}

		const now = new Date().toISOString();

		this.db.transaction((tx) => {
			// 1. Update order status + relevant timestamp
			const updates: Record<string, unknown> = {
				status: toStatus,
				updated_at: now,
			};

			if (toStatus === OrderStatus.READY) {
				updates.ready_at = now;
			} else if (toStatus === OrderStatus.DELIVERED) {
				updates.delivered_at = now;
			} else if (toStatus === OrderStatus.CANCELLED) {
				updates.cancelled_at = now;
			} else if (toStatus === OrderStatus.PREPARING && fromStatus === OrderStatus.READY) {
				// Undo ready: clear ready_at
				updates.ready_at = null;
			}

			tx.update(orders).set(updates).where(eq(orders.id, orderId)).run();

			// 2. Insert order event
			tx.insert(orderEvents)
				.values({
					id: randomUUID(),
					order_id: orderId,
					from_status: fromStatus,
					to_status: toStatus,
					terminal_id: input.terminal_id ?? null,
					created_at: now,
				})
				.run();

			// 3. READY -> enqueue announcement (idempotent)
			if (toStatus === OrderStatus.READY) {
				tx.insert(announcementQueue)
					.values({
						id: randomUUID(),
						order_id: orderId,
						display_no: order.display_no,
						type: "ready",
						status: "pending",
						enqueued_at: now,
					})
					.onConflictDoNothing()
					.run();
			}

			// 4. READY -> PREPARING (undo): remove pending/played announcement
			//    If announcement is currently 'playing', we skip deletion (worker owns it).
			if (fromStatus === OrderStatus.READY && toStatus === OrderStatus.PREPARING) {
				tx.delete(announcementQueue)
					.where(
						and(
							eq(announcementQueue.order_id, orderId),
							eq(announcementQueue.type, "ready"),
							sql`${announcementQueue.status} != 'playing'`,
						),
					)
					.run();
			}
		});

		return this.getById(orderId)!;
	}
}

export class OrderNotFoundError extends Error {
	constructor(id: string) {
		super(`Order not found: ${id}`);
		this.name = "OrderNotFoundError";
	}
}

export class InvalidTransitionError extends Error {
	public from: string;
	public to: string;
	constructor(from: string, to: string) {
		super(`Invalid status transition: ${from} -> ${to}`);
		this.name = "InvalidTransitionError";
		this.from = from;
		this.to = to;
	}
}
