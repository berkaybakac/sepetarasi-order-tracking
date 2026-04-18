import { API_ROUTES, SETTING_KEYS, WS_CHANNELS, WS_EVENTS } from "@sepetarasi/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import type { AppDatabase } from "../src/db/connection.js";
import { appSettings, terminals } from "../src/db/schema.js";
import { createTestDb } from "../src/db/test-utils.js";
import { OrderCommandService } from "../src/services/order.command.service.js";
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

	it("should return 409 when a UNIQUE constraint violation occurs", async () => {
		vi.spyOn(OrderCommandService.prototype, "create").mockImplementationOnce(() => {
			throw new Error("UNIQUE constraint failed: orders.business_date, orders.display_no");
		});

		const res = await app.inject({
			method: "POST",
			url: "/api/v1/orders",
			headers: withCashierAuth(),
			payload: buildCreateOrderInput({ customer_name: "Duplicate" }),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().error.code).toBe("DUPLICATE_ORDER");
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

	it("should disable caching for polling clients", async () => {
		const res = await app.inject({ method: "GET", url: "/api/v1/orders" });

		expect(res.statusCode).toBe(200);
		expect(res.headers["cache-control"]).toBe(
			"no-store, no-cache, must-revalidate, proxy-revalidate",
		);
		expect(res.headers.pragma).toBe("no-cache");
		expect(res.headers.expires).toBe("0");
		expect(res.headers["surrogate-control"]).toBe("no-store");
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

	it("should persist DELIVERED and broadcast both transitions for rapid READY -> DELIVERED requests", async () => {
		const createRes = await app.inject({
			method: "POST",
			url: "/api/v1/orders",
			headers: withCashierAuth(),
			payload: buildCreateOrderInput({ customer_name: "Hızlı Geçiş Testi", items: [] }),
		});
		const orderId = createRes.json().data.id as string;

		const broadcaster = (
			app as unknown as { broadcaster: { broadcast: (...args: unknown[]) => void } }
		).broadcaster;
		const broadcastSpy = vi.spyOn(broadcaster, "broadcast");

		const readyRes = await app.inject({
			method: "PATCH",
			url: `/api/v1/orders/${orderId}/status`,
			headers: withCashierAuth(),
			payload: { status: "READY" },
		});
		const deliveredRes = await app.inject({
			method: "PATCH",
			url: `/api/v1/orders/${orderId}/status`,
			headers: withCashierAuth(),
			payload: { status: "DELIVERED" },
		});

		expect(readyRes.statusCode).toBe(200);
		expect(deliveredRes.statusCode).toBe(200);

		const refreshedOrderRes = await app.inject({
			method: "GET",
			url: `/api/v1/orders/${orderId}`,
		});

		expect(refreshedOrderRes.statusCode).toBe(200);
		expect(refreshedOrderRes.json().data.status).toBe("DELIVERED");
		expect(refreshedOrderRes.json().data.ready_at).not.toBeNull();
		expect(refreshedOrderRes.json().data.delivered_at).not.toBeNull();

		const statusChangeCalls = broadcastSpy.mock.calls.filter(
			(call) => call[1] === WS_EVENTS.ORDER_STATUS_CHANGED,
		);
		expect(statusChangeCalls).toHaveLength(2);

		const firstPayload = statusChangeCalls[0]?.[2] as {
			status: string;
			previousStatus: string;
		};
		const secondPayload = statusChangeCalls[1]?.[2] as {
			status: string;
			previousStatus: string;
		};

		expect(firstPayload).toMatchObject({
			status: "READY",
			previousStatus: "PREPARING",
		});
		expect(secondPayload).toMatchObject({
			status: "DELIVERED",
			previousStatus: "READY",
		});
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
		expect(body.data).toHaveProperty("averageDeliverySeconds");
	});

	it("should exclude cancelled orders from totalOrders while keeping cancelled breakdown", async () => {
		const createRes = await app.inject({
			method: "POST",
			url: "/api/v1/orders",
			headers: withCashierAuth(),
			payload: buildCreateOrderInput({ customer_name: "Iptal KPI", items: [] }),
		});
		const orderId = createRes.json().data.id as string;

		const cancelRes = await app.inject({
			method: "PATCH",
			url: `/api/v1/orders/${orderId}/status`,
			headers: withCashierAuth(),
			payload: { status: "CANCELLED" },
		});
		expect(cancelRes.statusCode).toBe(200);

		const res = await app.inject({
			method: "GET",
			url: "/api/v1/stats/today",
			headers: { cookie: adminCookie },
		});
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.ok).toBe(true);
		expect(body.data.totalOrders).toBe(0);
		expect(body.data.byStatus.CANCELLED).toBe(1);
		expect(body.data.averagePrepMinutes).toBeNull();
		expect(body.data.averageDeliverySeconds).toBeNull();
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
		expect(body.data.admin_password_hash).toBeUndefined();
	});
});

describe("GET /api/v1/settings/public", () => {
	it("should return display settings without auth", async () => {
		db.insert(appSettings).values({ key: "restaurant_name", value: "Sepetarasi Mutfak" }).run();
		db.insert(appSettings).values({ key: "display_profile", value: "led_256x512" }).run();
		db.insert(appSettings).values({ key: "display_layout", value: "stack" }).run();
		db.insert(appSettings).values({ key: "display_max_visible", value: "6" }).run();
		db.insert(appSettings).values({ key: "display_page_seconds", value: "7" }).run();
		db.insert(appSettings).values({ key: "display_ready_minutes", value: "4" }).run();
		db.insert(appSettings).values({ key: "display_text_scale", value: "l" }).run();
		db.insert(appSettings).values({ key: "display_theme", value: "vivid" }).run();
		db.insert(appSettings).values({ key: "business_name", value: "Not Public" }).run();

		const res = await app.inject({
			method: "GET",
			url: "/api/v1/settings/public",
		});

		expect(res.statusCode).toBe(200);
		expect(res.headers["cache-control"]).toBe(
			"no-store, no-cache, must-revalidate, proxy-revalidate",
		);
		expect(res.headers.pragma).toBe("no-cache");
		expect(res.headers.expires).toBe("0");
		expect(res.headers["surrogate-control"]).toBe("no-store");
		const body = res.json();
		expect(body.ok).toBe(true);
		expect(body.data.restaurant_name).toBe("Sepetarasi Mutfak");
		expect(body.data.display_profile).toBe("led_256x512");
		expect(body.data.display_layout).toBe("stack");
		expect(body.data.display_max_visible).toBe("6");
		expect(body.data.display_page_seconds).toBe("7");
		expect(body.data.display_ready_minutes).toBe("4");
		expect(body.data.display_text_scale).toBe("l");
		expect(body.data.display_theme).toBe("vivid");
		expect(body.data.business_name).toBeUndefined();
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

	it("should accept display settings", async () => {
		const restaurantNameRes = await app.inject({
			method: "PATCH",
			url: "/api/v1/settings/restaurant_name",
			headers: { cookie: adminCookie },
			payload: { value: "Sepetarasi Mutfak" },
		});
		expect(restaurantNameRes.statusCode).toBe(200);

		const profileRes = await app.inject({
			method: "PATCH",
			url: "/api/v1/settings/display_profile",
			headers: { cookie: adminCookie },
			payload: { value: "tv_1080p" },
		});
		expect(profileRes.statusCode).toBe(200);

		const pageRes = await app.inject({
			method: "PATCH",
			url: "/api/v1/settings/display_page_seconds",
			headers: { cookie: adminCookie },
			payload: { value: "9" },
		});
		expect(pageRes.statusCode).toBe(200);

		const readyMinutesRes = await app.inject({
			method: "PATCH",
			url: "/api/v1/settings/display_ready_minutes",
			headers: { cookie: adminCookie },
			payload: { value: "10" },
		});
		expect(readyMinutesRes.statusCode).toBe(200);

		const textScaleRes = await app.inject({
			method: "PATCH",
			url: "/api/v1/settings/display_text_scale",
			headers: { cookie: adminCookie },
			payload: { value: "l" },
		});
		expect(textScaleRes.statusCode).toBe(200);

		const themeRes = await app.inject({
			method: "PATCH",
			url: "/api/v1/settings/display_theme",
			headers: { cookie: adminCookie },
			payload: { value: "retro" },
		});
		expect(themeRes.statusCode).toBe(200);
	});

	it("should reject invalid display_profile", async () => {
		const res = await app.inject({
			method: "PATCH",
			url: "/api/v1/settings/display_profile",
			headers: { cookie: adminCookie },
			payload: { value: "unknown-profile" },
		});
		expect(res.statusCode).toBe(400);
		expect(res.json().error.code).toBe("INVALID_SETTING_VALUE");
	});

	it("should reject invalid display_page_seconds", async () => {
		const res = await app.inject({
			method: "PATCH",
			url: "/api/v1/settings/display_page_seconds",
			headers: { cookie: adminCookie },
			payload: { value: "0" },
		});
		expect(res.statusCode).toBe(400);
		expect(res.json().error.code).toBe("INVALID_SETTING_VALUE");
	});

	it("should reject invalid display_ready_minutes", async () => {
		const res = await app.inject({
			method: "PATCH",
			url: "/api/v1/settings/display_ready_minutes",
			headers: { cookie: adminCookie },
			payload: { value: "61" },
		});
		expect(res.statusCode).toBe(400);
		expect(res.json().error.code).toBe("INVALID_SETTING_VALUE");
	});

	it("should reject invalid display_text_scale", async () => {
		const res = await app.inject({
			method: "PATCH",
			url: "/api/v1/settings/display_text_scale",
			headers: { cookie: adminCookie },
			payload: { value: "xl" },
		});
		expect(res.statusCode).toBe(400);
		expect(res.json().error.code).toBe("INVALID_SETTING_VALUE");
	});

	it("should reject invalid display_theme", async () => {
		const res = await app.inject({
			method: "PATCH",
			url: "/api/v1/settings/display_theme",
			headers: { cookie: adminCookie },
			payload: { value: "neon" },
		});
		expect(res.statusCode).toBe(400);
		expect(res.json().error.code).toBe("INVALID_SETTING_VALUE");
	});

	it("should broadcast settings:updated for delivery_target_minutes", async () => {
		const broadcaster = (
			app as unknown as { broadcaster: { broadcast: (...args: unknown[]) => void } }
		).broadcaster;
		const broadcastSpy = vi.spyOn(broadcaster, "broadcast");

		const res = await app.inject({
			method: "PATCH",
			url: `/api/v1/settings/${SETTING_KEYS.DELIVERY_TARGET_MINUTES}`,
			headers: { cookie: adminCookie },
			payload: { value: "30" },
		});

		expect(res.statusCode).toBe(200);

		const settingsUpdatedCall = broadcastSpy.mock.calls.find(
			(call) => call[1] === WS_EVENTS.SETTINGS_UPDATED,
		);
		expect(settingsUpdatedCall).toBeDefined();
		expect(settingsUpdatedCall?.[0]).toEqual([WS_CHANNELS.ORDERS]);
		expect(settingsUpdatedCall?.[2]).toEqual({
			key: SETTING_KEYS.DELIVERY_TARGET_MINUTES,
		});
	});
});

describe("PATCH /api/v1/settings/bulk", () => {
	it("should update multiple settings atomically", async () => {
		const res = await app.inject({
			method: "PATCH",
			url: "/api/v1/settings/bulk",
			headers: { cookie: adminCookie },
			payload: {
				settings: {
					restaurant_name: "Yeni Restoran",
					display_profile: "tv_1080p",
					display_layout: "split",
					display_page_seconds: "10",
					display_ready_minutes: "7",
					display_text_scale: "l",
					display_theme: "retro",
				},
			},
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().ok).toBe(true);

		const restaurant = db
			.select()
			.from(appSettings)
			.where(eq(appSettings.key, "restaurant_name"))
			.get();
		const profile = db
			.select()
			.from(appSettings)
			.where(eq(appSettings.key, "display_profile"))
			.get();
		const theme = db.select().from(appSettings).where(eq(appSettings.key, "display_theme")).get();

		expect(restaurant?.value).toBe("Yeni Restoran");
		expect(profile?.value).toBe("tv_1080p");
		expect(theme?.value).toBe("retro");
	});

	it("should reject invalid payload without partial writes", async () => {
		db.insert(appSettings).values({ key: "restaurant_name", value: "Eski Ad" }).run();
		db.insert(appSettings).values({ key: "display_theme", value: "dark" }).run();

		const res = await app.inject({
			method: "PATCH",
			url: "/api/v1/settings/bulk",
			headers: { cookie: adminCookie },
			payload: {
				settings: {
					restaurant_name: "Yeni Ad",
					display_theme: "neon",
				},
			},
		});

		expect(res.statusCode).toBe(400);
		expect(res.json().ok).toBe(false);
		expect(res.json().error.code).toBe("INVALID_SETTING_VALUE");

		const restaurant = db
			.select()
			.from(appSettings)
			.where(eq(appSettings.key, "restaurant_name"))
			.get();
		const theme = db.select().from(appSettings).where(eq(appSettings.key, "display_theme")).get();

		expect(restaurant?.value).toBe("Eski Ad");
		expect(theme?.value).toBe("dark");
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
		expect(res.json().data).toHaveProperty("averageDeliverySeconds");
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

describe("GET /api/v1/stats/delivery-analytics", () => {
	it("returns delivery analytics for a valid date range", async () => {
		const res = await app.inject({
			method: "GET",
			url: "/api/v1/stats/delivery-analytics?from=2026-04-10&to=2026-04-17",
			headers: { cookie: adminCookie },
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().ok).toBe(true);
		expect(res.json().data).toHaveProperty("summary");
		expect(res.json().data).toHaveProperty("timeSeries");
		expect(res.json().data).toHaveProperty("distribution");
	});

	it("returns 400 for an impossible calendar date", async () => {
		const res = await app.inject({
			method: "GET",
			url: "/api/v1/stats/delivery-analytics?from=2026-02-31&to=2026-03-02",
			headers: { cookie: adminCookie },
		});

		expect(res.statusCode).toBe(400);
		expect(res.json().ok).toBe(false);
		expect(res.json().error.code).toBe("INVALID_RANGE");
	});
});

describe("GET /health", () => {
	it("should return ok", async () => {
		const res = await app.inject({ method: "GET", url: "/health" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toMatchObject({
			ok: true,
			data: {
				services: {
					db: { ok: true },
					worker: { status: "disabled" },
					audio: {
						disabled: false,
						ttsFallbackEnabled: false,
						alsaDevice: null,
					},
				},
				websocket: {
					activeClientCount: 0,
				},
				disk: null,
			},
		});
		expect(res.json().data.timestamp).toEqual(expect.any(String));
		expect(res.json().data.uptime_s).toEqual(expect.any(Number));
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

	it("should expose audio runtime flags in health", async () => {
		const localApp = await buildApp({
			db,
			disableWorker: true,
			disableAudio: true,
			enableTtsFallback: true,
			alsaDevice: "plughw:CARD=Headphones,DEV=0",
		});

		try {
			const res = await localApp.inject({ method: "GET", url: "/health" });
			expect(res.statusCode).toBe(200);
			expect(res.json().data.services.audio).toEqual({
				disabled: true,
				ttsFallbackEnabled: true,
				alsaDevice: "plughw:CARD=Headphones,DEV=0",
			});
		} finally {
			await localApp.close();
		}
	});
});

describe("connectivity test pages", () => {
	let staticApp: FastifyInstance;

	beforeEach(async () => {
		staticApp = await buildApp({ db: createTestDb(), disableWorker: true });
	});

	afterEach(async () => {
		await staticApp.close();
	});

	it("serves /display as no-store HTML shell", async () => {
		const res = await staticApp.inject({ method: "GET", url: "/display" });

		expect(res.statusCode).toBe(200);
		expect(res.headers["content-type"]).toContain("text/html");
		expect(res.headers["cache-control"]).toBe(
			"no-store, no-cache, must-revalidate, proxy-revalidate",
		);
		expect(res.headers.pragma).toBe("no-cache");
		expect(res.headers.expires).toBe("0");
		expect(res.headers["surrogate-control"]).toBe("no-store");
		expect(res.body).toContain('<div id="root"></div>');
	});

	it("serves /display/ as the same no-store HTML shell", async () => {
		const res = await staticApp.inject({ method: "GET", url: "/display/" });

		expect(res.statusCode).toBe(200);
		expect(res.headers["content-type"]).toContain("text/html");
		expect(res.headers["cache-control"]).toBe(
			"no-store, no-cache, must-revalidate, proxy-revalidate",
		);
		expect(res.body).toContain('<div id="root"></div>');
	});

	it("serves /display.html as a no-store relative-asset shell with diagnostics", async () => {
		const res = await staticApp.inject({ method: "GET", url: "/display.html?layout=split&max=4" });

		expect(res.statusCode).toBe(200);
		expect(res.headers["content-type"]).toContain("text/html");
		expect(res.headers["cache-control"]).toBe(
			"no-store, no-cache, must-revalidate, proxy-revalidate",
		);
		expect(res.headers.pragma).toBe("no-cache");
		expect(res.headers.expires).toBe("0");
		expect(res.headers["surrogate-control"]).toBe("no-store");
		expect(res.body).toContain('<div id="root"></div>');
		expect(res.body).toContain('src="./assets/');
		expect(res.body).toContain('href="./assets/');
		expect(res.body).toContain('data-display-probe="armed"');
		expect(res.body).toContain("DISPLAY.HTML SHELL YUKLENDI");
		expect(res.body).toContain("window.onerror = function");
		expect(res.body).toContain("window.onunhandledrejection = function");
	});

	it("serves /display/index.html as a TB1 compatibility page", async () => {
		const res = await staticApp.inject({ method: "GET", url: "/display/index.html" });

		expect(res.statusCode).toBe(200);
		expect(res.headers["content-type"]).toContain("text/html");
		expect(res.headers["cache-control"]).toBe(
			"no-store, no-cache, must-revalidate, proxy-revalidate",
		);
		expect(res.body).toContain('id="prep-list"');
		expect(res.body).toContain('id="ready-list"');
		expect(res.body).toContain(API_ROUTES.V1.ORDERS);
		expect(res.body).toContain(API_ROUTES.V1.SETTINGS_PUBLIC);
		expect(res.body).not.toContain('type="module"');
		expect(res.body).not.toContain('<div id="root"></div>');
	});

	it("serves /test.html as plain HTML with no-store headers", async () => {
		const res = await staticApp.inject({ method: "GET", url: "/test.html" });

		expect(res.statusCode).toBe(200);
		expect(res.headers["content-type"]).toContain("text/html");
		expect(res.headers["cache-control"]).toBe(
			"no-store, no-cache, must-revalidate, proxy-revalidate",
		);
		expect(res.headers.pragma).toBe("no-cache");
		expect(res.headers.expires).toBe("0");
		expect(res.headers["surrogate-control"]).toBe("no-store");
		expect(res.body).toContain("BAĞLANTI BAŞARILI");
	});

	it("serves /ping with the same static success page", async () => {
		const res = await staticApp.inject({ method: "GET", url: "/ping" });

		expect(res.statusCode).toBe(200);
		expect(res.headers["content-type"]).toContain("text/html");
		expect(res.body).toContain("BAĞLANTI BAŞARILI");
	});

	it("accepts display diagnostic beacons without auth", async () => {
		const res = await staticApp.inject({
			method: "GET",
			url: "/display-beacon.gif?phase=react-mounted&path=%2Fdisplay.html",
		});

		expect(res.statusCode).toBe(200);
		expect(res.headers["content-type"]).toContain("image/gif");
		expect(res.headers["cache-control"]).toBe(
			"no-store, no-cache, must-revalidate, proxy-revalidate",
		);
		expect(Buffer.byteLength(res.body)).toBeGreaterThan(0);
	});
});
