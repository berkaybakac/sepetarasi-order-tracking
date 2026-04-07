import type { FastifyRequest, FastifyReply } from "fastify";
import { AUTH_CONFIG, CASHIER_TOKEN_HEADER } from "../config/auth.js";

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
	try {
		await request.jwtVerify({ onlyCookie: true });
	} catch (err) {
		return reply.code(401).send({ ok: false, error: { code: "UNAUTHORIZED", message: "Admin access required" } });
	}
}

export async function requireCashierOrAdmin(request: FastifyRequest, reply: FastifyReply) {
	// 1. Try admin cookie first
	try {
		await request.jwtVerify({ onlyCookie: true });
		return; // Is Admin
	} catch (err) {
		// Not admin, fallback to checking cashier token
	}

	// 2. Try cashier token
	const tokenHeader = request.headers[CASHIER_TOKEN_HEADER];
	const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
	if (token === AUTH_CONFIG.cashierToken) {
		return; // Is Cashier
	}

	return reply.code(401).send({ ok: false, error: { code: "UNAUTHORIZED", message: "Cashier token or Admin access required" } });
}
