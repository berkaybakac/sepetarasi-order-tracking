import type { FastifyInstance } from "fastify";
import { OrderStatus, WS_EVENTS, WS_CHANNELS } from "@sepetarasi/shared";
import type { CreateOrderInput, UpdateStatusInput } from "@sepetarasi/shared";
import {
	OrderService,
	OrderNotFoundError,
	InvalidTransitionError,
} from "../services/order.service.js";
import { StatsService } from "../services/stats.service.js";
import type { Broadcaster } from "../ws/broadcaster.js";
import type { AppDatabase } from "../db/connection.js";

export function registerOrderRoutes(
	app: FastifyInstance,
	db: AppDatabase,
	broadcaster: Broadcaster,
) {
	const orderService = new OrderService(db);
	const statsService = new StatsService(db);

	// POST /api/v1/orders
	app.post<{ Body: CreateOrderInput }>("/api/v1/orders", async (request, reply) => {
		const body = request.body;

		if (!body.items || body.items.length === 0) {
			return reply.status(400).send({
				ok: false,
				error: { code: "VALIDATION_ERROR", message: "At least one item is required" },
			});
		}

		try {
			const order = orderService.create(body);

			// Broadcast
			broadcaster.broadcast(
				[WS_CHANNELS.ORDERS, WS_CHANNELS.DISPLAY],
				WS_EVENTS.ORDER_CREATED,
				order,
			);

			// Broadcast updated stats
			const stats = statsService.getToday();
			broadcaster.broadcast([WS_CHANNELS.ORDERS], WS_EVENTS.STATS_UPDATED, stats);

			return reply.status(201).send({ ok: true, data: order });
		} catch (err: unknown) {
			if (err instanceof Error && err.message.includes("UNIQUE constraint")) {
				return reply.status(409).send({
					ok: false,
					error: { code: "DUPLICATE_ORDER", message: "Duplicate business_date + display_no" },
				});
			}
			throw err;
		}
	});

	// GET /api/v1/orders
	app.get<{
		Querystring: { business_date?: string; status?: string };
	}>("/api/v1/orders", async (request) => {
		const { business_date, status } = request.query;
		const orders = orderService.list(
			business_date || undefined,
			(status as OrderStatus) || undefined,
		);
		return { ok: true, data: orders };
	});

	// GET /api/v1/orders/:id
	app.get<{ Params: { id: string } }>("/api/v1/orders/:id", async (request, reply) => {
		const order = orderService.getById(request.params.id);
		if (!order) {
			return reply.status(404).send({
				ok: false,
				error: { code: "NOT_FOUND", message: "Order not found" },
			});
		}
		return { ok: true, data: order };
	});

	// PATCH /api/v1/orders/:id/status
	app.patch<{ Params: { id: string }; Body: UpdateStatusInput }>(
		"/api/v1/orders/:id/status",
		async (request, reply) => {
			const { id } = request.params;
			const body = request.body;

			if (!body.status || !Object.values(OrderStatus).includes(body.status)) {
				return reply.status(400).send({
					ok: false,
					error: { code: "VALIDATION_ERROR", message: "Invalid status value" },
				});
			}

			try {
				const order = orderService.changeStatus(id, body);

				// Broadcast status change
				broadcaster.broadcast(
					[WS_CHANNELS.ORDERS, WS_CHANNELS.DISPLAY],
					WS_EVENTS.ORDER_STATUS_CHANGED,
					{
						id: order.id,
						display_no: order.display_no,
						status: order.status,
						previousStatus: body.status === order.status ? undefined : body.status,
						ready_at: order.ready_at,
						delivered_at: order.delivered_at,
						cancelled_at: order.cancelled_at,
					},
				);

				// Broadcast updated stats
				const stats = statsService.getToday();
				broadcaster.broadcast([WS_CHANNELS.ORDERS], WS_EVENTS.STATS_UPDATED, stats);

				return { ok: true, data: order };
			} catch (err) {
				if (err instanceof OrderNotFoundError) {
					return reply.status(404).send({
						ok: false,
						error: { code: "NOT_FOUND", message: err.message },
					});
				}
				if (err instanceof InvalidTransitionError) {
					return reply.status(422).send({
						ok: false,
						error: {
							code: "INVALID_TRANSITION",
							message: err.message,
						},
					});
				}
				throw err;
			}
		},
	);
}
