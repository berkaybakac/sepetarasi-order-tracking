import { randomUUID } from "node:crypto";
import { OrderStatus, isValidTransition } from "@sepetarasi/shared";
import type { CreateOrderInput, UpdateStatusInput } from "@sepetarasi/shared";
import { and, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../db/connection.js";
import { announcementQueue, orderEvents, orderItems, orders, terminals } from "../db/schema.js";
import { InvalidTransitionError, OrderNotFoundError } from "./order.errors.js";
import { OrderQueryService } from "./order.query.service.js";

export class OrderCommandService {
	private query: OrderQueryService;

	constructor(private db: AppDatabase) {
		this.query = new OrderQueryService(db);
	}

	/** Create a new order with items (atomic) */
	create(input: CreateOrderInput) {
		const now = new Date().toISOString();
		const businessDate = this.query.getBusinessDate();
		const orderId = randomUUID();

		// Everything inside one transaction: display_no read + insert = no race condition
		this.db.transaction((tx) => {
			// Ensure terminal exists when terminal_id is provided by kasa client
			if (input.terminal_id) {
				tx.insert(terminals)
					.values({
						id: input.terminal_id,
						name: input.terminal_id,
						type: "kasa",
						is_active: 1,
						created_at: now,
					})
					.onConflictDoNothing()
					.run();
			}

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

		// biome-ignore lint/style/noNonNullAssertion: order was just inserted in the transaction above
		return this.query.getById(orderId)!;
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

		// biome-ignore lint/style/noNonNullAssertion: order was just updated in the transaction above
		return this.query.getById(orderId)!;
	}

	/** Delete an order completely */
	delete(orderId: string) {
		const order = this.db.select().from(orders).where(eq(orders.id, orderId)).get();
		if (!order) {
			throw new OrderNotFoundError(orderId);
		}

		this.db.transaction((tx) => {
			tx.delete(orders).where(eq(orders.id, orderId)).run();
		});

		return order;
	}
}
