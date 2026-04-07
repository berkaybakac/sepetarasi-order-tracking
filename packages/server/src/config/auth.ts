import { randomBytes } from "node:crypto";

export const ADMIN_COOKIE_NAME = "admin_token";
export const CASHIER_TOKEN_HEADER = "x-cashier-token";

const isProduction = (process.env.NODE_ENV ?? "").toLowerCase() === "production";
const devSecrets = new Map<string, string>();

function getDevSecret(name: string) {
	const cached = devSecrets.get(name);
	if (cached) return cached;

	const generated = `dev-${name.toLowerCase()}-${randomBytes(16).toString("hex")}`;
	devSecrets.set(name, generated);
	return generated;
}

function getSecret(name: string) {
	const value = process.env[name]?.trim();
	if (value) return value;
	if (isProduction) {
		throw new Error(`${name} must be set in production environment`);
	}
	return getDevSecret(name);
}

function getCashierToken() {
	const value = process.env.CASHIER_TOKEN?.trim();
	if (value) return value;
	if (isProduction) {
		throw new Error("CASHIER_TOKEN must be set in production environment");
	}
	return "local-dev-cashier-token";
}

export const AUTH_CONFIG = {
	isProduction,
	jwtSecret: getSecret("JWT_SECRET"),
	cookieSecret: getSecret("COOKIE_SECRET"),
	cashierToken: getCashierToken(),
} as const;
