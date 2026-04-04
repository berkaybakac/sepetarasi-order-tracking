import type { OrderStatus } from "@sepetarasi/shared";
import { and, desc, eq } from "drizzle-orm";
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

		const items = this.db.select().from(orderItems).where(eq(orderItems.order_id, id)).all();
		const events = this.db.select().from(orderEvents).where(eq(orderEvents.order_id, id)).all();

		return { ...order, items, events };
	}
}
