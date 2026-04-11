import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
	process.env = { ...ORIGINAL_ENV };
}

function setProductionEnvWithAllSecrets() {
	process.env.NODE_ENV = "production";
	process.env.JWT_SECRET = "jwt-secret-for-test";
	process.env.COOKIE_SECRET = "cookie-secret-for-test";
	process.env.CASHIER_TOKEN = "cashier-token-for-test";
	process.env.WS_AUTH_KEY = "ws-key-for-test";
}

function unsetEnv(name: string) {
	process.env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== name));
}

async function importAuthConfigFresh() {
	vi.resetModules();
	return import("../src/config/auth.js");
}

afterEach(() => {
	restoreEnv();
	vi.resetModules();
});

describe("AUTH_CONFIG fail-fast behavior", () => {
	it("throws in production when JWT_SECRET is missing", async () => {
		setProductionEnvWithAllSecrets();
		unsetEnv("JWT_SECRET");

		await expect(importAuthConfigFresh()).rejects.toThrow(
			"JWT_SECRET must be set in production environment",
		);
	});

	it("throws in production when COOKIE_SECRET is missing", async () => {
		setProductionEnvWithAllSecrets();
		unsetEnv("COOKIE_SECRET");

		await expect(importAuthConfigFresh()).rejects.toThrow(
			"COOKIE_SECRET must be set in production environment",
		);
	});

	it("throws in production when CASHIER_TOKEN is missing", async () => {
		setProductionEnvWithAllSecrets();
		unsetEnv("CASHIER_TOKEN");

		await expect(importAuthConfigFresh()).rejects.toThrow(
			"CASHIER_TOKEN must be set in production environment",
		);
	});

	it("uses development fallbacks when not in production", async () => {
		process.env.NODE_ENV = "development";
		unsetEnv("JWT_SECRET");
		unsetEnv("COOKIE_SECRET");
		unsetEnv("CASHIER_TOKEN");

		const { AUTH_CONFIG } = await importAuthConfigFresh();
		expect(AUTH_CONFIG.isProduction).toBe(false);
		expect(AUTH_CONFIG.jwtSecret).toContain("dev-jwt_secret-");
		expect(AUTH_CONFIG.cookieSecret).toContain("dev-cookie_secret-");
		expect(AUTH_CONFIG.cashierToken).toBe("local-dev-cashier-token");
	});
});

describe("AUTH_CONFIG cookieSecure override", () => {
	it("COOKIE_SECURE=false forces cookieSecure=false even in production", async () => {
		setProductionEnvWithAllSecrets();
		process.env.WS_AUTH_KEY = "ws-key-for-test";
		process.env.COOKIE_SECURE = "false";

		const { AUTH_CONFIG } = await importAuthConfigFresh();
		expect(AUTH_CONFIG.cookieSecure).toBe(false);
	});

	it("COOKIE_SECURE=true forces cookieSecure=true even in dev", async () => {
		process.env.NODE_ENV = "development";
		process.env.COOKIE_SECURE = "true";

		const { AUTH_CONFIG } = await importAuthConfigFresh();
		expect(AUTH_CONFIG.cookieSecure).toBe(true);
	});

	it("when COOKIE_SECURE is unset, cookieSecure follows isProduction", async () => {
		setProductionEnvWithAllSecrets();
		unsetEnv("COOKIE_SECURE");

		const { AUTH_CONFIG: prodConfig } = await importAuthConfigFresh();
		expect(prodConfig.cookieSecure).toBe(true);

		restoreEnv();
		vi.resetModules();

		process.env.NODE_ENV = "development";
		unsetEnv("COOKIE_SECURE");

		const { AUTH_CONFIG: devConfig } = await importAuthConfigFresh();
		expect(devConfig.cookieSecure).toBe(false);
	});

	it("throws for invalid COOKIE_SECURE values", async () => {
		setProductionEnvWithAllSecrets();
		process.env.COOKIE_SECURE = "maybe";

		await expect(importAuthConfigFresh()).rejects.toThrow(
			"COOKIE_SECURE must be a boolean value (true/false)",
		);
	});
});
