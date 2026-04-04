/**
 * Backward-compatible barrel — imports from the split service files.
 * Existing tests and any external callers can continue using OrderService,
 * while new code should prefer OrderQueryService / OrderCommandService directly.
 */
export * from "./order.errors.js";
export * from "./order.query.service.js";
export * from "./order.command.service.js";

import type { CreateOrderInput, OrderStatus, UpdateStatusInput } from "@sepetarasi/shared";
import type { AppDatabase } from "../db/connection.js";
import { OrderCommandService } from "./order.command.service.js";
import { OrderQueryService } from "./order.query.service.js";

/** @deprecated Use OrderQueryService / OrderCommandService directly. */
export class OrderService {
	private query: OrderQueryService;
	private command: OrderCommandService;

	constructor(db: AppDatabase) {
		this.query = new OrderQueryService(db);
		this.command = new OrderCommandService(db);
	}

	create(input: CreateOrderInput) {
		return this.command.create(input);
	}

	list(businessDate?: string, status?: OrderStatus) {
		return this.query.list(businessDate, status);
	}

	getById(id: string) {
		return this.query.getById(id);
	}

	changeStatus(orderId: string, input: UpdateStatusInput) {
		return this.command.changeStatus(orderId, input);
	}
}
