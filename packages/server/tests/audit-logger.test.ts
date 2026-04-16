import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditLog } from "../src/utils/audit-logger.js";

describe("auditLog", () => {
	const originalEnv = process.env.LOG_PATH;

	beforeEach(() => {
		process.env.LOG_PATH = undefined;
	});

	afterEach(() => {
		if (originalEnv === undefined) {
			process.env.LOG_PATH = undefined;
		} else {
			process.env.LOG_PATH = originalEnv;
		}
	});

	it("writes structured JSON to configured file path", () => {
		const logDir = mkdtempSync(join(tmpdir(), "sepetarasi-audit-"));
		const logPath = join(logDir, "audit.log");
		process.env.LOG_PATH = logPath;

		const logger = {
			info: vi.fn(),
			error: vi.fn(),
		};

		auditLog(
			"ORDER_CREATED",
			"Order created",
			{ actor: "cashier", orderId: "abc-123", displayNo: 42 },
			logger,
		);

		const lines = readFileSync(logPath, "utf-8").trim().split("\n");
		expect(lines).toHaveLength(1);

		const parsed = JSON.parse(lines[0]);
		expect(parsed).toMatchObject({
			level: "info",
			component: "audit",
			event: "ORDER_CREATED",
			action: "ORDER_CREATED",
			details: "Order created",
			msg: "Order created",
			actor: "cashier",
			orderId: "abc-123",
			displayNo: 42,
		});
		expect(typeof parsed.timestamp).toBe("string");
		expect(logger.info).toHaveBeenCalledTimes(1);
		expect(logger.error).not.toHaveBeenCalled();
	});
});
