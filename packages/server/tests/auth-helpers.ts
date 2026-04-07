import { API_ROUTES } from "@sepetarasi/shared";
import type { FastifyInstance } from "fastify";
import { AUTH_CONFIG, CASHIER_TOKEN_HEADER } from "../src/config/auth.js";

export function withCashierAuth(headers: Record<string, string> = {}) {
	return {
		...headers,
		[CASHIER_TOKEN_HEADER]: AUTH_CONFIG.cashierToken,
	};
}

export async function loginAsAdmin(app: FastifyInstance, password = "admin123") {
	const loginRes = await app.inject({
		method: "POST",
		url: API_ROUTES.V1.AUTH.LOGIN,
		payload: { password },
	});

	if (loginRes.statusCode !== 200) {
		throw new Error(`Admin login failed in test setup: ${loginRes.statusCode}`);
	}

	const setCookie = loginRes.headers["set-cookie"];
	const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
	if (!cookieHeader) {
		throw new Error("Admin login did not return a Set-Cookie header");
	}

	return cookieHeader.split(";")[0];
}
