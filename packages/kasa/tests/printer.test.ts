import iconv from "iconv-lite";
import { describe, expect, it } from "vitest";
import { buildReceiptDocument } from "../electron/printer";

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
		expect(text).toContain("Müşteri: Songül Hanım");
		expect(text).toContain("Tip: Paket");
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

		expect(text).toContain("Tip: Masada");
		expect(text).not.toContain("Not:");
	});
});
