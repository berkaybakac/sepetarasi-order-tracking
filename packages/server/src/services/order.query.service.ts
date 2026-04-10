import type { OrderStatus } from "@sepetarasi/shared";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../db/connection.js";
import { orderEvents, orderItems, orders } from "../db/schema.js";

export class OrderQueryService {
	constructor(private db: AppDatabase) {}

	/** Get today's business_date string (YYYY-MM-DD) in store timezone */
	getBusinessDate(): string {
		const tz = process.env.STORE_TIMEZONE || "Europe/Istanbul";
		return new Date().toLocaleDateString("en-CA", { timeZone: tz });
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

		if (orderRows.length === 0) {
			return [];
		}

		const orderIds = orderRows.map((order) => order.id);
		const itemRows = this.db
			.select()
			.from(orderItems)
			.where(inArray(orderItems.order_id, orderIds))
			.all();

		const itemsByOrderId = new Map<string, typeof itemRows>();
		for (const item of itemRows) {
			const bucket = itemsByOrderId.get(item.order_id);
			if (bucket) {
				bucket.push(item);
			} else {
				itemsByOrderId.set(item.order_id, [item]);
			}
		}

		return orderRows.map((order) => ({
			...order,
			items: itemsByOrderId.get(order.id) ?? [],
		}));
	}

	/** Get single order by ID with items and events */
	getById(id: string) {
		const order = this.db.select().from(orders).where(eq(orders.id, id)).get();
		if (!order) return null;

		const items = this.db.select().from(orderItems).where(eq(orderItems.order_id, id)).all();
		const events = this.db.select().from(orderEvents).where(eq(orderEvents.order_id, id)).all();

		return { ...order, items, events };
	}
}
