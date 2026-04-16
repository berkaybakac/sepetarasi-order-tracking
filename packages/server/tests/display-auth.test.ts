import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { buildApp } from "../src/app.js";
import { createTestDb } from "../src/db/test-utils.js";
import { TEST_HOST, tcpListenPort } from "./helpers.js";

describe("WebSocket Display Channel (Password-less)", () => {
	let app: FastifyInstance;
	let port: number;

	beforeEach(async () => {
		const db = createTestDb();
		app = await buildApp({ db, disableWorker: true, disableStatic: true });
		await app.listen({ port: 0, host: TEST_HOST });
		port = tcpListenPort(app.server);
	});

	afterEach(async () => {
		await app.close();
	});

	it("should accept connection for display channel WITHOUT key", async () => {
		const ws = new WebSocket(`ws://${TEST_HOST}:${port}/ws?channel=display`);

		const isOpen = await new Promise((resolve) => {
			ws.on("open", () => {
				ws.close();
				resolve(true);
			});
			ws.on("error", (err) => {
				console.error("WS Error:", err);
				resolve(false);
			});
			ws.on("close", () => resolve(false));
			setTimeout(() => resolve(false), 2000);
		});

		expect(isOpen).toBe(true);
	});

	it("should still reject connection for orders channel WITHOUT key", async () => {
		const ws = new WebSocket(`ws://${TEST_HOST}:${port}/ws?channel=orders`);

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

		expect(["unauthorized_msg", "closed"]).toContain(result);
	});
});
