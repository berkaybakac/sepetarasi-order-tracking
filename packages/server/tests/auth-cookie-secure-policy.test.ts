import { API_ROUTES } from "@sepetarasi/shared";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppDatabase } from "../src/db/connection.js";
import { createTestDb } from "../src/db/test-utils.js";

const ORIGINAL_ENV = { ...process.env };
let app: FastifyInstance | null = null;

function setProductionEnvWithAllSecrets() {
	process.env.NODE_ENV = "production";
	process.env.JWT_SECRET = "jwt-secret-for-test";
	process.env.COOKIE_SECRET = "cookie-secret-for-test";
	process.env.CASHIER_TOKEN = "cashier-token-for-test";
	process.env.WS_AUTH_KEY = "ws-key-for-test";
}

async function buildFreshApp() {
	vi.resetModules();
	const { buildApp } = await import("../src/app.js");
	const db: AppDatabase = createTestDb();
	app = await buildApp({ db, disableWorker: true, disableStatic: true });
}

afterEach(async () => {
	if (app) {
		await app.close();
		app = null;
	}
	process.env = { ...ORIGINAL_ENV };
	vi.resetModules();
});

describe("Auth cookie Secure policy", () => {
	it("does not set Secure on plain HTTP requests even when COOKIE_SECURE=true", async () => {
		setProductionEnvWithAllSecrets();
		process.env.COOKIE_SECURE = "true";
		await buildFreshApp();

		const res = await app!.inject({
			method: "POST",
			url: API_ROUTES.V1.AUTH.LOGIN,
			payload: { password: "admin123" },
		});

		expect(res.statusCode).toBe(200);
		expect(String(res.headers["set-cookie"])).not.toContain("Secure");
	});

	it("sets Secure when request is marked as HTTPS and COOKIE_SECURE=true", async () => {
		setProductionEnvWithAllSecrets();
		process.env.COOKIE_SECURE = "true";
		await buildFreshApp();

		const res = await app!.inject({
			method: "POST",
			url: API_ROUTES.V1.AUTH.LOGIN,
			headers: { "x-forwarded-proto": "https" },
			payload: { password: "admin123" },
		});

		expect(res.statusCode).toBe(200);
		expect(String(res.headers["set-cookie"])).toContain("Secure");
	});
});
