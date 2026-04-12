import iconv from "iconv-lite";
import { describe, expect, it } from "vitest";
import {
	type PrinterEncodingWarning,
	buildReceiptDocument,
	isRetryablePrintError,
} from "../electron/printer";

function decodeReceipt(buffer: Buffer) {
	return Array.from(iconv.decode(buffer, "cp857"), (char) =>
		char.charCodeAt(0) < 32 ? "\n" : char,
	).join("");
}

describe("printer receipt", () => {
	it("renders two copies with order metadata and note", () => {
		const receipt = buildReceiptDocument({
			display_no: 7,
			customer_name: "Songül Hanım",
			order_type: "Paket",
			notes: "Az acılı olsun",
			created_at: "2026-03-08T10:14:00.000Z",
		});

		const text = decodeReceipt(receipt);

		expect(text).toContain("ÇALIŞAN KOPYASI");
		expect(text).toContain("MÜŞTERİ KOPYASI");
		expect(text).toContain("0007");
		expect(text).toContain("Paket");
		expect(text).not.toContain("Tip:");
		expect(text).toContain("Müşteri: Songül Hanım");
		expect(text).toContain("Saat: 08.03.2026 13:14");
		expect(text).toContain("Not: Az acılı olsun");
	});

	it("omits the note line when no note is provided", () => {
		const receipt = buildReceiptDocument({
			display_no: 12,
			customer_name: "Kemal",
			order_type: "Masada",
			notes: null,
			created_at: "2026-03-08T10:14:00.000Z",
		});

		const text = decodeReceipt(receipt);

		expect(text).toContain("Masada");
		expect(text).not.toContain("Tip:");
		expect(text).not.toContain("Not:");
	});

	it("omits the note line when note has only whitespace", () => {
		const receipt = buildReceiptDocument({
			display_no: 21,
			customer_name: "Ayşe",
			order_type: "Paket",
			notes: "   \t   ",
			created_at: "2026-03-08T10:14:00.000Z",
		});

		const text = decodeReceipt(receipt);

		expect(text).not.toContain("Not:");
	});

	it("wraps very long words into multiple lines", () => {
		const longWord = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
		const receipt = buildReceiptDocument({
			display_no: 31,
			customer_name: "Deneme",
			order_type: "Paket",
			notes: longWord,
			created_at: "2026-03-08T10:14:00.000Z",
		});

		const text = decodeReceipt(receipt);
		const firstChunk = longWord.slice(0, 32);
		const secondChunk = longWord.slice(32);

		expect(text).toContain(`Not:\n${firstChunk}\n${secondChunk}`);
	});
});

describe("retryable print errors", () => {
	it("marks transient network errors as retryable", () => {
		expect(isRetryablePrintError(new Error("connect ECONNRESET 192.168.1.12:9100"))).toBe(true);
		expect(isRetryablePrintError(new Error("Printer timeout: 192.168.1.12:9100"))).toBe(true);
	});

	it("does not mark non-network errors as retryable", () => {
		expect(isRetryablePrintError(new Error("Validation failed: display_no must be numeric"))).toBe(
			false,
		);
	});
});

describe("printer charset diagnostics", () => {
	it("warns when unsupported punctuation is transliterated", () => {
		const warnings: PrinterEncodingWarning[] = [];
		const receipt = buildReceiptDocument(
			{
				display_no: 41,
				customer_name: "Berkay",
				order_type: "Paket",
				notes: "Özel not — test…",
				created_at: "2026-03-08T10:14:00.000Z",
			},
			{
				codePage: 61,
				encoding: "cp857",
				onWarning: (warning) => warnings.push(warning),
			},
		);

		const text = decodeReceipt(receipt);

		expect(text).toContain("Not: Özel not - test...");
		expect(warnings.some((warning) => warning.field === "notes")).toBe(true);
	});

	it("throws for unsupported encoding names", () => {
		expect(() =>
			buildReceiptDocument(
				{
					display_no: 42,
					customer_name: "Test",
					order_type: "Paket",
					notes: null,
					created_at: "2026-03-08T10:14:00.000Z",
				},
				{
					encoding: "unsupported-encoding-x",
				},
			),
		).toThrow("Unsupported printer encoding");
	});
});
