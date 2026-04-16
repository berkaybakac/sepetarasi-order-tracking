import { API_ROUTES, type OrderStatus, WS_CHANNELS, WS_EVENTS } from "@sepetarasi/shared";
import type { CreateOrderInput, UpdateStatusInput } from "@sepetarasi/shared";
import type { FastifyInstance } from "fastify";
import type { AppDatabase } from "../db/connection.js";
import { OrderCommandService } from "../services/order.command.service.js";
import { InvalidOrderInputError } from "../services/order.command.service.js";
import { InvalidTransitionError, OrderNotFoundError } from "../services/order.errors.js";
import { OrderQueryService } from "../services/order.query.service.js";
import { StatsService } from "../services/stats.service.js";
import { auditLog } from "../utils/audit-logger.js";
import { requireAdmin, requireCashierOrAdmin } from "../utils/auth-middleware.js";
import type { Broadcaster } from "../ws/broadcaster.js";
import { createOrderBodySchema, updateStatusBodySchema } from "./schemas.js";

export function registerOrderRoutes(
	app: FastifyInstance,
	db: AppDatabase,
	broadcaster: Broadcaster,
) {
	const orderQuery = new OrderQueryService(db);
	const orderCommand = new OrderCommandService(db);
	const statsService = new StatsService(db);

	// POST /api/v1/orders
	app.post<{ Body: CreateOrderInput }>(
		API_ROUTES.V1.ORDERS,
		{
			preHandler: requireCashierOrAdmin,
			schema: { body: createOrderBodySchema },
		},
		async (request, reply) => {
			try {
				const order = orderCommand.create(request.body);
				auditLog(
					"ORDER_CREATED",
					"Order created",
					{
						actor: "cashier_or_admin",
						ip: request.ip,
						requestId: request.id,
						path: request.url,
						orderId: order.id,
						displayNo: order.display_no,
					},
					request.log,
				);

				broadcaster.broadcast(
					[WS_CHANNELS.ORDERS, WS_CHANNELS.DISPLAY],
					WS_EVENTS.ORDER_CREATED,
					order,
				);

				const stats = statsService.getToday();
				broadcaster.broadcast([WS_CHANNELS.ORDERS], WS_EVENTS.STATS_UPDATED, stats);

				return reply.status(201).send({ ok: true, data: order });
			} catch (err: unknown) {
				if (err instanceof InvalidOrderInputError) {
					return reply.status(400).send({
						ok: false,
						error: { code: "INVALID_ORDER_INPUT", message: err.message },
					});
				}
				if (err instanceof Error && err.message.includes("UNIQUE constraint")) {
					return reply.status(409).send({
						ok: false,
						error: { code: "DUPLICATE_ORDER", message: "Duplicate business_date + display_no" },
					});
				}
				throw err;
			}
		},
	);

	// GET /api/v1/orders
	app.get<{
		Querystring: { business_date?: string; status?: string };
	}>(API_ROUTES.V1.ORDERS, async (request) => {
		const { business_date, status } = request.query;
		const orderList = orderQuery.list(
			business_date || undefined,
			(status as OrderStatus) || undefined,
		);
		return { ok: true, data: orderList };
	});

	// GET /api/v1/orders/:id
	app.get<{ Params: { id: string } }>(API_ROUTES.V1.ORDER_BY_ID, async (request, reply) => {
		const order = orderQuery.getById(request.params.id);
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
		{
			preHandler: requireCashierOrAdmin,
			schema: { body: updateStatusBodySchema },
		},
		async (request, reply) => {
			const { id } = request.params;

			try {
				const { order, previousStatus } = orderCommand.changeStatusWithMeta(id, request.body);

				auditLog(
					"ORDER_STATUS_CHANGED",
					`Order status changed: ${previousStatus} → ${order.status}`,
					{
						actor: "cashier_or_admin",
						ip: request.ip,
						requestId: request.id,
						path: request.url,
						orderId: order.id,
						displayNo: order.display_no,
					},
					request.log,
				);

				broadcaster.broadcast(
					[WS_CHANNELS.ORDERS, WS_CHANNELS.DISPLAY],
					WS_EVENTS.ORDER_STATUS_CHANGED,
					{
						id: order.id,
						display_no: order.display_no,
						status: order.status,
						previousStatus,
						ready_at: order.ready_at,
						delivered_at: order.delivered_at,
						cancelled_at: order.cancelled_at,
					},
				);

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
						error: { code: "INVALID_TRANSITION", message: err.message },
					});
				}
				throw err;
			}
		},
	);

	// DELETE /api/v1/orders/:id
	app.delete<{ Params: { id: string } }>(
		"/api/v1/orders/:id",
		{ preHandler: requireAdmin },
		async (request, reply) => {
			const { id } = request.params;
			try {
				const order = orderCommand.delete(id);
				auditLog(
					"ORDER_DELETED",
					"Order deleted",
					{
						actor: "admin",
						ip: request.ip,
						requestId: request.id,
						path: request.url,
						orderId: id,
						displayNo: order.display_no,
					},
					request.log,
				);

				// Provide real-time update that an order was removed
				const stats = statsService.getToday();
				broadcaster.broadcast([WS_CHANNELS.ORDERS], WS_EVENTS.STATS_UPDATED, stats);

				return { ok: true, data: { message: "Order deleted successfully" } };
			} catch (err) {
				if (err instanceof OrderNotFoundError) {
					return reply.status(404).send({
						ok: false,
						error: { code: "NOT_FOUND", message: err.message },
					});
				}
				throw err;
			}
		},
	);
}
