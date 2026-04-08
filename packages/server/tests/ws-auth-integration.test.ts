import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { buildApp } from "../src/app.js";
import { createTestDb } from "../src/db/test-utils.js";
import { tcpListenPort } from "./helpers.js";

describe("WebSocket Authentication Integration", () => {
	let app: FastifyInstance;
	let port: number;

	beforeEach(async () => {
		const db = createTestDb();
		app = await buildApp({ db, disableWorker: true, disableStatic: true });
		await app.listen({ port: 0 }); // Listen on random port
		port = tcpListenPort(app.server);
	});

	afterEach(async () => {
		await app.close();
	});

	it("should reject connection with missing key", async () => {
		const ws = new WebSocket(`ws://localhost:${port}/ws`);

		const result = await new Promise((resolve) => {
			ws.on("error", () => resolve("error"));
			ws.on("message", (data) => {
				const msg = JSON.parse(data.toString());
				if (msg.event === "error" && msg.message === "Unauthorized") {
					resolve("unauthorized_msg");
				}
			});
			ws.on("close", () => resolve("closed"));
		});

		expect(["unauthorized_msg", "closed"]).toContain(result);
	});

	it("should accept connection with correct key", async () => {
		// We need to know the key. Since it's generated randomly in dev if not set,
		// we can either set it via process.env or just check if it's there.
		const authConfig = (await import("../src/config/auth.js")).AUTH_CONFIG;
		const correctKey = authConfig.wsAuthKey;

		const ws = new WebSocket(`ws://localhost:${port}/ws?key=${correctKey}`);

		const isOpen = await new Promise((resolve) => {
			ws.on("open", () => {
				ws.close();
				resolve(true);
			});
			ws.on("error", () => resolve(false));
			ws.on("close", () => resolve(false));
		});

		expect(isOpen).toBe(true);
	});

	it("should reject connection with incorrect key", async () => {
		const ws = new WebSocket(`ws://localhost:${port}/ws?key=wrong-key`);

		const result = await new Promise((resolve) => {
			ws.on("message", (data) => {
				const msg = JSON.parse(data.toString());
				if (msg.event === "error" && msg.message === "Unauthorized") {
					resolve("unauthorized_msg");
				}
			});
			ws.on("close", () => resolve("closed"));
			setTimeout(() => resolve("timeout"), 2000);
		});

		expect(result).toBe("unauthorized_msg");
	});
});
