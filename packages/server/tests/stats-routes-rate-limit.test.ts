import { API_ROUTES } from "@sepetarasi/shared";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { DELIVERY_ANALYTICS_RATE_LIMIT } from "../src/config/rate-limit.js";
import type { AppDatabase } from "../src/db/connection.js";
import { createTestDb } from "../src/db/test-utils.js";
import { loginAsAdmin } from "./auth-helpers.js";

const ANALYTICS_URL = `${API_ROUTES.V1.STATS_DELIVERY_ANALYTICS}?from=2026-04-17&to=2026-04-17`;

let db: AppDatabase;
let app: FastifyInstance;
let adminCookie: string;

beforeEach(async () => {
	db = createTestDb();
	app = await buildApp({ db, disableWorker: true, disableStatic: true });
	adminCookie = await loginAsAdmin(app);
});

afterEach(async () => {
	await app.close();
});

describe("Stats routes rate limiting", () => {
	it("returns retryAfterSeconds in delivery analytics 429 responses", async () => {
		for (let i = 0; i < DELIVERY_ANALYTICS_RATE_LIMIT.max; i += 1) {
			const res = await app.inject({
				method: "GET",
				url: ANALYTICS_URL,
				headers: { cookie: adminCookie },
			});
			expect(res.statusCode).toBe(200);
		}

		const limitedRes = await app.inject({
			method: "GET",
			url: ANALYTICS_URL,
			headers: { cookie: adminCookie },
		});
		const retryAfterSeconds = Number(limitedRes.headers["retry-after"]);
		const body = limitedRes.json();

		expect(limitedRes.statusCode).toBe(429);
		expect(retryAfterSeconds).toBeGreaterThan(0);
		expect(body).toMatchObject({
			ok: false,
			error: {
				code: "RATE_LIMITED",
			},
			retryAfterSeconds,
		});
		expect(body.error.message).toContain("İstek sınırına ulaşıldı.");
	});
});
