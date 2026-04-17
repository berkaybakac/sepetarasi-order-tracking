import { API_ROUTES, PASSWORD_MIN_LENGTH, SETTING_KEYS } from "@sepetarasi/shared";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { ADMIN_COOKIE_NAME, AUTH_CONFIG } from "../config/auth.js";
import type { AppDatabase } from "../db/connection.js";
import { appSettings } from "../db/schema.js";
import { auditLog } from "../utils/audit-logger.js";

function isHttpsRequest(request: FastifyRequest): boolean {
	const forwardedProto = request.headers["x-forwarded-proto"];
	const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
	const normalizedForwardedProto = proto?.split(",")[0]?.trim()?.toLowerCase();
	return request.protocol === "https" || normalizedForwardedProto === "https";
}

async function getAdminHash(db: AppDatabase): Promise<string> {
	const row = db
		.select()
		.from(appSettings)
		.where(eq(appSettings.key, SETTING_KEYS.ADMIN_PASSWORD_HASH))
		.get();
	if (row?.value) return row.value;

	// If no hash exists, initialize default 'admin123'
	const defaultHash = await bcrypt.hash("admin123", 10);
	db.insert(appSettings)
		.values({
			key: SETTING_KEYS.ADMIN_PASSWORD_HASH,
			value: defaultHash,
			updated_at: new Date().toISOString(),
		})
		.onConflictDoUpdate({
			target: appSettings.key,
			set: { value: defaultHash, updated_at: new Date().toISOString() },
		})
		.run();
	return defaultHash;
}

async function verifyAdminPassword(db: AppDatabase, password?: string): Promise<boolean> {
	const hash = await getAdminHash(db);
	return bcrypt.compare(password ?? "", hash);
}

export function registerAuthRoutes(app: FastifyInstance, db: AppDatabase) {
	// POST /api/v1/auth/login
	app.post<{ Body: { password?: string } }>(
		API_ROUTES.V1.AUTH.LOGIN,
		{
			schema: {
				body: {
					type: "object",
					properties: { password: { type: "string" } },
					required: ["password"],
				},
			},
			config: {
				// Keep auth endpoint stricter than generic API routes.
				rateLimit: { max: 100, timeWindow: "1 minute" },
			},
		},
		async (request, reply) => {
			const { password } = request.body;
			const match = await verifyAdminPassword(db, password);
			if (!match) {
				auditLog(
					"LOGIN_FAILED",
					"Invalid admin password",
					{
						actor: "admin",
						ip: request.ip,
						requestId: request.id,
						path: request.url,
					},
					request.log,
				);
				return reply
					.code(401)
					.send({ ok: false, error: { code: "UNAUTHORIZED", message: "Invalid password" } });
			}

			const token = app.jwt.sign({ role: "admin" }, { expiresIn: "7d" });
			const secureCookie = AUTH_CONFIG.cookieSecure && isHttpsRequest(request);

			auditLog(
				"LOGIN_SUCCESS",
				"Admin logged in",
				{
					actor: "admin",
					ip: request.ip,
					requestId: request.id,
					path: request.url,
				},
				request.log,
			);

			// Send http-only secure cookie
			reply.setCookie(ADMIN_COOKIE_NAME, token, {
				path: "/",
				httpOnly: true,
				secure: secureCookie,
				sameSite: "strict",
				maxAge: 60 * 60 * 24 * 7, // 7 days
			});

			return { ok: true, data: { message: "Logged in successfully" } };
		},
	);

	// POST /api/v1/auth/verify-password
	app.post<{ Body: { password?: string } }>(
		API_ROUTES.V1.AUTH.VERIFY_PASSWORD,
		{
			schema: {
				body: {
					type: "object",
					properties: { password: { type: "string" } },
					required: ["password"],
				},
			},
			config: {
				rateLimit: { max: 100, timeWindow: "1 minute" },
			},
		},
		async (request, reply) => {
			const { password } = request.body;
			const match = await verifyAdminPassword(db, password);

			if (!match) {
				auditLog(
					"RECONFIG_UNLOCK_FAILED",
					"Invalid admin password for kasa config unlock",
					{
						actor: "admin_unlock",
						ip: request.ip,
						requestId: request.id,
						path: request.url,
					},
					request.log,
				);
				return reply
					.code(401)
					.send({ ok: false, error: { code: "UNAUTHORIZED", message: "Invalid password" } });
			}

			auditLog(
				"RECONFIG_UNLOCK_SUCCESS",
				"Admin password verified for kasa config unlock",
				{
					actor: "admin_unlock",
					ip: request.ip,
					requestId: request.id,
					path: request.url,
				},
				request.log,
			);
			return { ok: true, data: null };
		},
	);

	// POST /api/v1/auth/logout
	app.post(API_ROUTES.V1.AUTH.LOGOUT, async (request, reply) => {
		reply.clearCookie(ADMIN_COOKIE_NAME, { path: "/" });
		auditLog(
			"LOGOUT",
			"Admin logged out",
			{
				actor: "admin",
				ip: request.ip,
				requestId: request.id,
				path: request.url,
			},
			request.log,
		);
		return { ok: true, data: null };
	});

	// GET /api/v1/auth/me
	app.get(API_ROUTES.V1.AUTH.ME, async (request, reply) => {
		try {
			await request.jwtVerify({ onlyCookie: true });
			return { ok: true, data: { role: "admin" } };
		} catch (err) {
			return reply
				.code(401)
				.send({ ok: false, error: { code: "UNAUTHORIZED", message: "Not logged in" } });
		}
	});

	// POST /api/v1/auth/change-password
	app.post<{ Body: { currentPassword?: string; newPassword?: string } }>(
		API_ROUTES.V1.AUTH.CHANGE_PASSWORD,
		{
			schema: {
				body: {
					type: "object",
					properties: {
						currentPassword: { type: "string" },
						newPassword: { type: "string", minLength: PASSWORD_MIN_LENGTH },
					},
					required: ["currentPassword", "newPassword"],
				},
			},
		},
		async (request, reply) => {
			// Require auth
			try {
				await request.jwtVerify({ onlyCookie: true });
			} catch (err) {
				return reply
					.code(401)
					.send({ ok: false, error: { code: "UNAUTHORIZED", message: "Not logged in" } });
			}

			const { currentPassword, newPassword } = request.body;
			const match = await verifyAdminPassword(db, currentPassword);
			if (!match) {
				return reply.code(400).send({
					ok: false,
					error: { code: "INVALID_CURRENT_PASSWORD", message: "Current password is wrong" },
				});
			}

			const newHash = await bcrypt.hash(newPassword ?? "", 10);
			db.insert(appSettings)
				.values({
					key: SETTING_KEYS.ADMIN_PASSWORD_HASH,
					value: newHash,
					updated_at: new Date().toISOString(),
				})
				.onConflictDoUpdate({
					target: appSettings.key,
					set: { value: newHash, updated_at: new Date().toISOString() },
				})
				.run();

			auditLog(
				"PASSWORD_CHANGED",
				"Admin password changed",
				{
					actor: "admin",
					ip: request.ip,
					requestId: request.id,
					path: request.url,
				},
				request.log,
			);
			return { ok: true, data: { message: "Password updated successfully" } };
		},
	);
}
