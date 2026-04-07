import { API_ROUTES } from "@sepetarasi/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { AppDatabase } from "../src/db/connection.js";
import { orders, terminals } from "../src/db/schema.js";
import { createTestDb } from "../src/db/test-utils.js";
import { loginAsAdmin, withCashierAuth } from "./auth-helpers.js";

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
		payload: {
			terminal_id: "t-1",
			items: [{ name: "Lahmacun", quantity: 1, unit_price: 12000 }],
		},
	});

	expect(createRes.statusCode).toBe(201);
	return createRes.json().data.id as string;
}

describe("DELETE /api/v1/orders/:id", () => {
	it("returns 200 and actually deletes the order", async () => {
		const orderId = await createOrder();

		const deleteRes = await app.inject({
			method: "DELETE",
			url: API_ROUTES.V1.ORDER_BY_ID.replace(":id", orderId),
			headers: { cookie: adminCookie },
		});

		expect(deleteRes.statusCode).toBe(200);
		expect(deleteRes.json()).toEqual({
			ok: true,
			data: { message: "Order deleted successfully" },
		});

		const dbOrder = db.select().from(orders).where(eq(orders.id, orderId)).get();
		expect(dbOrder).toBeUndefined();

		const getRes = await app.inject({
			method: "GET",
			url: API_ROUTES.V1.ORDER_BY_ID.replace(":id", orderId),
		});
		expect(getRes.statusCode).toBe(404);
	});

	it("returns 401 for anonymous request", async () => {
		const orderId = await createOrder();

		const res = await app.inject({
			method: "DELETE",
			url: API_ROUTES.V1.ORDER_BY_ID.replace(":id", orderId),
		});

		expect(res.statusCode).toBe(401);
		expect(res.json().error.code).toBe("UNAUTHORIZED");
	});

	it("returns 404 when order does not exist", async () => {
		const res = await app.inject({
			method: "DELETE",
			url: API_ROUTES.V1.ORDER_BY_ID.replace(":id", "missing-order-id"),
			headers: { cookie: adminCookie },
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().error.code).toBe("NOT_FOUND");
	});
});
