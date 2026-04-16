import { describe, expect, it } from "vitest";
import { sanitizeLogValue, serializeLogError, summarizeTextChange } from "../src/lib/logging";

describe("kasa logging helpers", () => {
	it("summarizes text changes without returning raw sensitive content", () => {
		const summary = summarizeTextChange("notes", "cp857", 61, "Songül Hanım", "Songul Hanim");

		expect(summary).toEqual({
			field: "notes",
			encoding: "cp857",
			codePage: 61,
			originalLength: 12,
			renderedLength: 12,
			changedCharacterCount: 2,
		});
		expect(summary).not.toHaveProperty("original");
		expect(summary).not.toHaveProperty("rendered");
	});

	it("serializes errors into plain log-safe objects", () => {
		const error = Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });

		expect(serializeLogError(error)).toMatchObject({
			name: "Error",
			message: "socket hang up",
			code: "ECONNRESET",
		});
	});

	it("sanitizes nested values recursively for structured logs", () => {
		const value = sanitizeLogValue({
			ok: true,
			items: [1, new Error("boom")],
			meta: { nested: { value: "x" } },
		});

		expect(value).toEqual({
			ok: true,
			items: [1, { name: "Error", message: "boom", stack: expect.any(String) }],
			meta: { nested: { value: "x" } },
		});
	});
});
