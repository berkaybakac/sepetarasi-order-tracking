import { WS_EVENTS } from "@sepetarasi/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import type { AppDatabase } from "../src/db/connection.js";
import { appSettings, terminals } from "../src/db/schema.js";
import { createTestDb } from "../src/db/test-utils.js";
import { buildCreateOrderInput, loginAsAdmin, withCashierAuth } from "./auth-helpers.js";

let db: AppDatabase;
let app: FastifyInstance;
let adminCookie: string;

beforeEach(async () => {
	db = createTestDb();
	db.insert(terminals).values({ id: "t-1", name: "Kasa 1", type: "kasa", is_active: 1 }).run();
	app = await buildApp({ db, disableWorker: true });
	adminCookie = await loginAsAdmin(app);
});

afterEach(async () => {
	await app.close();
});

describe("POST /api/v1/orders", () => {
	it("should create an order and return 201", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/v1/orders",
			headers: withCashierAuth(),
			payload: buildCreateOrderInput({
				terminal_id: "t-1",
				customer_name: "Ayşe",
				items: [{ name: "Doner", quantity: 1, unit_price: 15000 }],
			}),
		});

		expect(res.statusCode).toBe(201);
		const body = res.json();
		expect(body.ok).toBe(true);
		expect(body.data.display_no).toBe(1);
		expect(body.data.status).toBe("PREPARING");
		expect(body.data.items).toHaveLength(1);
		expect(body.data.customer_name).toBe("Ayşe");
		expect(body.data.order_type).toBe("Paket");
		expect(body.data.created_at).toEqual(expect.any(String));
	});

	it("should allow empty items when required order metadata is present", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/v1/orders",
			headers: withCashierAuth(),
			payload: buildCreateOrderInput({ customer_name: "Zeynep", items: [] }),
		});

		expect(res.statusCode).toBe(201);
		expect(res.json().data.items).toEqual([]);
	});

	it("should return 400 when customer_name is missing", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/v1/orders",
			headers: withCashierAuth(),
			payload: { order_type: "Paket", items: [] },
		});

		expect(res.statusCode).toBe(400);
		expect(res.json().error.code).toBe("VALIDATION_ERROR");
	});

	it("should return 400 when customer_name is blank after trimming", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/v1/orders",
			headers: withCashierAuth(),
			payload: buildCreateOrderInput({ customer_name: "   " }),
		});

		expect(res.statusCode).toBe(400);
		expect(res.json().error.code).toBe("INVALID_ORDER_INPUT");
	});

	it("should return 400 when order_type is invalid", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/v1/orders",
			headers: withCashierAuth(),
			payload: { customer_name: "Ali", order_type: "TakeAway", items: [] },
		});

		expect(res.statusCode).toBe(400);
		expect(res.json().error.code).toBe("VALIDATION_ERROR");
	});

	it("should auto-create missing terminal and still create order", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/v1/orders",
			headers: withCashierAuth(),
			payload: buildCreateOrderInput({
				terminal_id: "KASA-1",
				customer_name: "Kemal",
				items: [{ name: "Pizza", quantity: 1, unit_price: 20000 }],
			}),
		});

		expect(res.statusCode).toBe(201);
		expect(res.json().ok).toBe(true);
		expect(res.json().data.terminal_id).toBe("KASA-1");

		const insertedTerminal = db.select().from(terminals).where(eq(terminals.id, "KASA-1")).get();
		expect(insertedTerminal).toBeDefined();
	});
});

describe("GET /api/v1/orders", () => {
	it("should list today's orders", async () => {
		// Create two orders
		await app.inject({
			method: "POST",
			url: "/api/v1/orders",
			headers: withCashierAuth(),
			payload: buildCreateOrderInput({ customer_name: "Birinci", items: [] }),
		});
		await app.inject({
			method: "POST",
			url: "/api/v1/orders",
			headers: withCashierAuth(),
			payload: buildCreateOrderInput({ customer_name: "İkinci", order_type: "Masada", items: [] }),
		});

		const res = await app.inject({ method: "GET", url: "/api/v1/orders" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.ok).toBe(true);
		expect(body.data).toHaveLength(2);
	});
});

describe("PATCH /api/v1/orders/:id/status", () => {
	it("should transition to READY and return updated order", async () => {
		const createRes = await app.inject({
			method: "POST",
			url: "/api/v1/orders",
			headers: withCashierAuth(),
			payload: buildCreateOrderInput({ customer_name: "Hazır Testi", items: [] }),
		});
		const orderId = createRes.json().data.id;

		const res = await app.inject({
			method: "PATCH",
			url: `/api/v1/orders/${orderId}/status`,
			headers: withCashierAuth(),
			payload: { status: "READY" },
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.data.status).toBe("READY");
		expect(body.data.ready_at).not.toBeNull();
	});

	it("should broadcast previousStatus in ORDER_STATUS_CHANGED payload", async () => {
		const createRes = await app.inject({
			method: "POST",
			url: "/api/v1/orders",
			headers: withCashierAuth(),
			payload: buildCreateOrderInput({ customer_name: "Broadcast Testi", items: [] }),
		});
		const orderId = createRes.json().data.id;

		const broadcaster = (
			app as unknown as { broadcaster: { broadcast: (...args: unknown[]) => void } }
		).broadcaster;
		const broadcastSpy = vi.spyOn(broadcaster, "broadcast");

		const res = await app.inject({
			method: "PATCH",
			url: `/api/v1/orders/${orderId}/status`,
			headers: withCashierAuth(),
			payload: { status: "READY" },
		});

		expect(res.statusCode).toBe(200);

		const statusChangeCall = broadcastSpy.mock.calls.find(
			(call) => call[1] === WS_EVENTS.ORDER_STATUS_CHANGED,
		);
		expect(statusChangeCall).toBeDefined();
		const payload = statusChangeCall?.[2] as { previousStatus?: string };
		expect(payload.previousStatus).toBe("PREPARING");
	});

	it("should return 422 for invalid transition", async () => {
		const createRes = await app.inject({
			method: "POST",
			url: "/api/v1/orders",
			headers: withCashierAuth(),
			payload: buildCreateOrderInput({ customer_name: "Geçiş Testi", items: [] }),
		});
		const orderId = createRes.json().data.id;

		const res = await app.inject({
			method: "PATCH",
			url: `/api/v1/orders/${orderId}/status`,
			headers: withCashierAuth(),
			payload: { status: "DELIVERED" },
		});

		expect(res.statusCode).toBe(422);
		expect(res.json().error.code).toBe("INVALID_TRANSITION");
	});

	it("should return 404 for non-existent order", async () => {
		const res = await app.inject({
			method: "PATCH",
			url: "/api/v1/orders/non-existent/status",
			headers: withCashierAuth(),
			payload: { status: "READY" },
		});

		expect(res.statusCode).toBe(404);
	});
});

describe("GET /api/v1/stats/today", () => {
	it("should return stats with correct counts", async () => {
		await app.inject({
			method: "POST",
			url: "/api/v1/orders",
			headers: withCashierAuth(),
			payload: buildCreateOrderInput({ customer_name: "Stats Testi", items: [] }),
		});

		const res = await app.inject({
			method: "GET",
			url: "/api/v1/stats/today",
			headers: { cookie: adminCookie },
		});
		const body = res.json();
		expect(body.ok).toBe(true);
		expect(body.data.totalOrders).toBe(1);
		expect(body.data.byStatus.PREPARING).toBe(1);
	});
});

describe("POST /api/v1/orders with new fields", () => {
	it("should accept customer_name, order_type, target_minutes", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/v1/orders",
			headers: withCashierAuth(),
			payload: {
				customer_name: "Ali",
				order_type: "Paket",
				target_minutes: 15,
				items: [],
			},
		});

		expect(res.statusCode).toBe(201);
		const order = res.json().data;
		expect(order.customer_name).toBe("Ali");
		expect(order.order_type).toBe("Paket");
		expect(order.target_minutes).toBe(15);
		expect(order.items).toEqual([]);
	});
});

describe("GET /api/v1/settings", () => {
	it("should return settings as key-value object", async () => {
		db.insert(appSettings).values({ key: "business_name", value: "Test Cafe" }).run();
		db.insert(appSettings).values({ key: "receipt_phone", value: "555-1234" }).run();

		const res = await app.inject({
			method: "GET",
			url: "/api/v1/settings",
			headers: { cookie: adminCookie },
		});
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.ok).toBe(true);
		expect(body.data.business_name).toBe("Test Cafe");
		expect(body.data.receipt_phone).toBe("555-1234");
	});
});

describe("PATCH /api/v1/settings/:key", () => {
	it("should upsert setting value", async () => {
		const res = await app.inject({
			method: "PATCH",
			url: "/api/v1/settings/audio_volume",
			headers: { cookie: adminCookie },
			payload: { value: "75" },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().ok).toBe(true);

		const row = db.select().from(appSettings).where(eq(appSettings.key, "audio_volume")).get();
		expect(row?.value).toBe("75");
	});

	it("should reject invalid audio_volume", async () => {
		const res = await app.inject({
			method: "PATCH",
			url: "/api/v1/settings/audio_volume",
			headers: { cookie: adminCookie },
			payload: { value: "200" },
		});
		expect(res.statusCode).toBe(400);
		expect(res.json().ok).toBe(false);
		expect(res.json().error.code).toBe("INVALID_SETTING_VALUE");
	});

	it("should reject unknown setting keys", async () => {
		const res = await app.inject({
			method: "PATCH",
			url: "/api/v1/settings/unsupported_key",
			headers: { cookie: adminCookie },
			payload: { value: "x" },
		});

		expect(res.statusCode).toBe(400);
		expect(res.json().ok).toBe(false);
		expect(res.json().error.code).toBe("INVALID_SETTING_KEY");
	});

	it("should accept business_name as editable setting", async () => {
		const res = await app.inject({
			method: "PATCH",
			url: "/api/v1/settings/business_name",
			headers: { cookie: adminCookie },
			payload: { value: "Test Cafe Updated" },
		});

		expect(res.statusCode).toBe(200);
		const row = db.select().from(appSettings).where(eq(appSettings.key, "business_name")).get();
		expect(row?.value).toBe("Test Cafe Updated");
	});
});

describe("GET /api/v1/stats", () => {
	it("returns daily stats by default", async () => {
		const res = await app.inject({
			method: "GET",
			url: "/api/v1/stats",
			headers: { cookie: adminCookie },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().ok).toBe(true);
		expect(res.json().data).toHaveProperty("totalOrders");
		expect(res.json().data).toHaveProperty("averagePrepMinutes");
	});

	it("accepts weekly and monthly period", async () => {
		for (const period of ["weekly", "monthly"]) {
			const res = await app.inject({
				method: "GET",
				url: `/api/v1/stats?period=${period}`,
				headers: { cookie: adminCookie },
			});
			expect(res.statusCode).toBe(200);
			expect(res.json().ok).toBe(true);
		}
	});

	it("returns 400 for invalid period", async () => {
		const res = await app.inject({
			method: "GET",
			url: "/api/v1/stats?period=invalid",
			headers: { cookie: adminCookie },
		});
		expect(res.statusCode).toBe(400);
		expect(res.json().ok).toBe(false);
		expect(res.json().error.code).toBe("INVALID_PERIOD");
	});
});

describe("GET /health", () => {
	it("should return ok", async () => {
		const res = await app.inject({ method: "GET", url: "/health" });
		expect(res.statusCode).toBe(200);
		expect(res.json().ok).toBe(true);
	});

	it("should include CORS headers on normal response", async () => {
		const res = await app.inject({
			method: "GET",
			url: "/health",
			headers: { origin: "http://localhost:5173" },
		});

		expect(res.statusCode).toBe(200);
		expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
		expect(res.headers["access-control-allow-methods"]).toBe("GET,POST,PATCH,PUT,DELETE,OPTIONS");
	});

	it("should handle CORS preflight requests", async () => {
		const res = await app.inject({
			method: "OPTIONS",
			url: "/health",
			headers: {
				origin: "http://localhost:5173",
				"access-control-request-method": "GET",
			},
		});

		expect(res.statusCode).toBe(204);
		expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
		expect(res.headers["access-control-allow-headers"]).toBe(
			"Content-Type, Authorization, x-cashier-token",
		);
	});
});
