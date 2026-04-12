import { API_ROUTES } from "@sepetarasi/shared";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { AppDatabase } from "../src/db/connection.js";
import { terminals } from "../src/db/schema.js";
import { createTestDb } from "../src/db/test-utils.js";
import { buildCreateOrderInput, loginAsAdmin, withCashierAuth } from "./auth-helpers.js";

let db: AppDatabase;
let app: FastifyInstance;
let adminCookie: string;

beforeEach(async () => {
	db = createTestDb();
	db.insert(terminals).values({ id: "t-1", name: "Kasa 1", type: "kasa", is_active: 1 }).run();
	app = await buildApp({ db, disableWorker: true, disableStatic: true });
	adminCookie = await loginAsAdmin(app);
});

afterEach(async () => {
	await app.close();
});

async function createOrder() {
	const createRes = await app.inject({
		method: "POST",
		url: API_ROUTES.V1.ORDERS,
		headers: withCashierAuth(),
		payload: buildCreateOrderInput({
			terminal_id: "t-1",
			customer_name: "Yetki Testi",
		}),
	});

	expect(createRes.statusCode).toBe(201);
	return createRes.json().data.id as string;
}

describe("Permission matrix", () => {
	it("POST /api/v1/orders allows admin and cashier, rejects anonymous", async () => {
		const payload = buildCreateOrderInput({
			terminal_id: "t-1",
			customer_name: "Müşteri Yetki",
		});

		const anonymousRes = await app.inject({
			method: "POST",
			url: API_ROUTES.V1.ORDERS,
			payload,
		});
		expect(anonymousRes.statusCode).toBe(401);

		const cashierRes = await app.inject({
			method: "POST",
			url: API_ROUTES.V1.ORDERS,
			headers: withCashierAuth(),
			payload,
		});
		expect(cashierRes.statusCode).toBe(201);

		const adminRes = await app.inject({
			method: "POST",
			url: API_ROUTES.V1.ORDERS,
			headers: { cookie: adminCookie },
			payload,
		});
		expect(adminRes.statusCode).toBe(201);
	});

	it("PATCH /api/v1/orders/:id/status allows admin and cashier, rejects anonymous", async () => {
		const orderIdForAnonymous = await createOrder();
		const anonymousRes = await app.inject({
			method: "PATCH",
			url: API_ROUTES.V1.ORDER_STATUS(orderIdForAnonymous),
			payload: { status: "READY" },
		});
		expect(anonymousRes.statusCode).toBe(401);

		const orderIdForCashier = await createOrder();
		const cashierRes = await app.inject({
			method: "PATCH",
			url: API_ROUTES.V1.ORDER_STATUS(orderIdForCashier),
			headers: withCashierAuth(),
			payload: { status: "READY" },
		});
		expect(cashierRes.statusCode).toBe(200);

		const orderIdForAdmin = await createOrder();
		const adminRes = await app.inject({
			method: "PATCH",
			url: API_ROUTES.V1.ORDER_STATUS(orderIdForAdmin),
			headers: { cookie: adminCookie },
			payload: { status: "READY" },
		});
		expect(adminRes.statusCode).toBe(200);
	});

	it("GET /api/v1/settings allows only admin", async () => {
		const anonymousRes = await app.inject({
			method: "GET",
			url: API_ROUTES.V1.SETTINGS,
		});
		expect(anonymousRes.statusCode).toBe(401);

		const cashierRes = await app.inject({
			method: "GET",
			url: API_ROUTES.V1.SETTINGS,
			headers: withCashierAuth(),
		});
		expect(cashierRes.statusCode).toBe(401);

		const adminRes = await app.inject({
			method: "GET",
			url: API_ROUTES.V1.SETTINGS,
			headers: { cookie: adminCookie },
		});
		expect(adminRes.statusCode).toBe(200);
	});

	it("GET /api/v1/settings/public allows anonymous, cashier, and admin", async () => {
		const anonymousRes = await app.inject({
			method: "GET",
			url: API_ROUTES.V1.SETTINGS_PUBLIC,
		});
		expect(anonymousRes.statusCode).toBe(200);

		const cashierRes = await app.inject({
			method: "GET",
			url: API_ROUTES.V1.SETTINGS_PUBLIC,
			headers: withCashierAuth(),
		});
		expect(cashierRes.statusCode).toBe(200);

		const adminRes = await app.inject({
			method: "GET",
			url: API_ROUTES.V1.SETTINGS_PUBLIC,
			headers: { cookie: adminCookie },
		});
		expect(adminRes.statusCode).toBe(200);
	});

	it("DELETE /api/v1/orders/:id allows only admin", async () => {
		const orderId = await createOrder();

		const anonymousRes = await app.inject({
			method: "DELETE",
			url: API_ROUTES.V1.ORDER_BY_ID.replace(":id", orderId),
		});
		expect(anonymousRes.statusCode).toBe(401);

		const cashierRes = await app.inject({
			method: "DELETE",
			url: API_ROUTES.V1.ORDER_BY_ID.replace(":id", orderId),
			headers: withCashierAuth(),
		});
		expect(cashierRes.statusCode).toBe(401);

		const adminRes = await app.inject({
			method: "DELETE",
			url: API_ROUTES.V1.ORDER_BY_ID.replace(":id", orderId),
			headers: { cookie: adminCookie },
		});
		expect(adminRes.statusCode).toBe(200);
	});
});
