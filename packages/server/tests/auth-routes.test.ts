import { API_ROUTES } from "@sepetarasi/shared";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { AppDatabase } from "../src/db/connection.js";
import { createTestDb } from "../src/db/test-utils.js";
import { loginAsAdmin } from "./auth-helpers.js";

type JwtEnabledFastify = FastifyInstance & {
	jwt: {
		sign: (payload: Record<string, unknown>, options?: Record<string, unknown>) => string;
	};
};

let db: AppDatabase;
let app: FastifyInstance;

beforeEach(async () => {
	db = createTestDb();
	app = await buildApp({ db, disableWorker: true, disableStatic: true });
});

afterEach(async () => {
	await app.close();
});

function firstSetCookieValue(res: { headers: Record<string, unknown> }) {
	const setCookie = res.headers["set-cookie"];
	const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
	if (typeof raw !== "string") return null;
	return raw.split(";")[0];
}

describe("Auth routes contract", () => {
	it("POST /auth/login returns cookie on success", async () => {
		const res = await app.inject({
			method: "POST",
			url: API_ROUTES.V1.AUTH.LOGIN,
			payload: { password: "admin123" },
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().ok).toBe(true);
		expect(res.headers["set-cookie"]).toBeDefined();
		expect(String(res.headers["set-cookie"])).toContain("admin_token=");
	});

	it("POST /auth/login rejects invalid password", async () => {
		const res = await app.inject({
			method: "POST",
			url: API_ROUTES.V1.AUTH.LOGIN,
			payload: { password: "wrong-password" },
		});

		expect(res.statusCode).toBe(401);
		expect(res.json().ok).toBe(false);
		expect(res.json().error.code).toBe("UNAUTHORIZED");
	});

	it("GET /auth/me returns 401 for anonymous", async () => {
		const res = await app.inject({ method: "GET", url: API_ROUTES.V1.AUTH.ME });
		expect(res.statusCode).toBe(401);
		expect(res.json().ok).toBe(false);
	});

	it("GET /auth/me returns 200 for valid admin cookie", async () => {
		const adminCookie = await loginAsAdmin(app);
		const res = await app.inject({
			method: "GET",
			url: API_ROUTES.V1.AUTH.ME,
			headers: { cookie: adminCookie },
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().ok).toBe(true);
		expect(res.json().data.role).toBe("admin");
	});

	it("GET /auth/me returns 401 for invalid cookie", async () => {
		const res = await app.inject({
			method: "GET",
			url: API_ROUTES.V1.AUTH.ME,
			headers: { cookie: "admin_token=not-a-valid-jwt" },
		});
		expect(res.statusCode).toBe(401);
	});

	it("GET /auth/me returns 401 for expired cookie", async () => {
		const expiredToken = (app as JwtEnabledFastify).jwt.sign(
			{ role: "admin" },
			{ expiresIn: "-1s" },
		);
		const res = await app.inject({
			method: "GET",
			url: API_ROUTES.V1.AUTH.ME,
			headers: { cookie: `admin_token=${expiredToken}` },
		});

		expect(res.statusCode).toBe(401);
	});

	it("protected admin routes return 401 for invalid or expired cookie", async () => {
		const invalidCookieRes = await app.inject({
			method: "GET",
			url: API_ROUTES.V1.SETTINGS,
			headers: { cookie: "admin_token=broken-token" },
		});
		expect(invalidCookieRes.statusCode).toBe(401);

		const expiredToken = (app as JwtEnabledFastify).jwt.sign(
			{ role: "admin" },
			{ expiresIn: "-1s" },
		);
		const expiredCookieRes = await app.inject({
			method: "GET",
			url: API_ROUTES.V1.SETTINGS,
			headers: { cookie: `admin_token=${expiredToken}` },
		});
		expect(expiredCookieRes.statusCode).toBe(401);
	});

	it("login -> me -> logout -> me cycle works", async () => {
		const adminCookie = await loginAsAdmin(app);

		const meBeforeLogout = await app.inject({
			method: "GET",
			url: API_ROUTES.V1.AUTH.ME,
			headers: { cookie: adminCookie },
		});
		expect(meBeforeLogout.statusCode).toBe(200);

		const logoutRes = await app.inject({
			method: "POST",
			url: API_ROUTES.V1.AUTH.LOGOUT,
			headers: { cookie: adminCookie },
		});
		expect(logoutRes.statusCode).toBe(200);

		const clearedCookie = firstSetCookieValue(logoutRes);
		expect(clearedCookie).toBeTruthy();

		const meAfterLogout = await app.inject({
			method: "GET",
			url: API_ROUTES.V1.AUTH.ME,
			headers: { cookie: String(clearedCookie) },
		});
		expect(meAfterLogout.statusCode).toBe(401);
	});

	it("POST /auth/change-password enforces auth and current password", async () => {
		const unauthorized = await app.inject({
			method: "POST",
			url: API_ROUTES.V1.AUTH.CHANGE_PASSWORD,
			payload: { currentPassword: "admin123", newPassword: "new-password-1" },
		});
		expect(unauthorized.statusCode).toBe(401);

		const adminCookie = await loginAsAdmin(app);
		const wrongCurrent = await app.inject({
			method: "POST",
			url: API_ROUTES.V1.AUTH.CHANGE_PASSWORD,
			headers: { cookie: adminCookie },
			payload: { currentPassword: "wrong-password", newPassword: "new-password-1" },
		});
		expect(wrongCurrent.statusCode).toBe(400);
		expect(wrongCurrent.json().error.code).toBe("INVALID_CURRENT_PASSWORD");
	});

	it("password change invalidates old password and accepts new password", async () => {
		const adminCookie = await loginAsAdmin(app);
		const changeRes = await app.inject({
			method: "POST",
			url: API_ROUTES.V1.AUTH.CHANGE_PASSWORD,
			headers: { cookie: adminCookie },
			payload: { currentPassword: "admin123", newPassword: "new-password-1" },
		});
		expect(changeRes.statusCode).toBe(200);

		const oldPasswordLogin = await app.inject({
			method: "POST",
			url: API_ROUTES.V1.AUTH.LOGIN,
			payload: { password: "admin123" },
		});
		expect(oldPasswordLogin.statusCode).toBe(401);

		const newPasswordLogin = await app.inject({
			method: "POST",
			url: API_ROUTES.V1.AUTH.LOGIN,
			payload: { password: "new-password-1" },
		});
		expect(newPasswordLogin.statusCode).toBe(200);
	});
});
