#!/usr/bin/env tsx
/**
 * Yazıcı bağlantı ve baskı test scripti.
 *
 * Kullanım:
 *   npx tsx scripts/test-print.ts <printer-ip> [--encoding cp857] [--codepage 61]
 *   npx tsx scripts/test-print.ts 192.168.1.12
 */
import {
	type PrinterEncodingWarning,
	printReceiptWithRetry,
} from "../packages/kasa/electron/printer.ts";

function readArg(args: string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	if (index === -1) return undefined;
	return args[index + 1];
}

const args = process.argv.slice(2);
const printerIp = args[0];
const encoding = (readArg(args, "--encoding") ?? "cp857").trim().toLowerCase();
const codePageRaw = readArg(args, "--codepage") ?? "61";
const codePage = Number.parseInt(codePageRaw, 10);

if (!printerIp) {
	console.error("Hata: Yazıcı IP adresi gerekli.");
	console.error(
		"Kullanım: npx tsx scripts/test-print.ts <printer-ip> [--encoding cp857] [--codepage 61]",
	);
	console.error(
		"Örnek:    npx tsx scripts/test-print.ts 192.168.1.12 --encoding cp857 --codepage 61",
	);
	process.exit(1);
}

if (Number.isNaN(codePage) || codePage < 0 || codePage > 255) {
	console.error(`Hata: Geçersiz codepage değeri: ${codePageRaw}`);
	console.error("Codepage 0 ile 255 arasında olmalı.");
	process.exit(1);
}

const testOrder = {
	display_no: 1,
	customer_name: "Test Müşteri",
	order_type: "Paket",
	notes: "Bu bir test fişidir — Türkçe: ğüşiöçĞÜŞİÖÇ",
	created_at: new Date().toISOString(),
};

console.log(`Yazıcıya bağlanılıyor: ${printerIp}:9100`);
console.log(
	`Sipariş: #${String(testOrder.display_no).padStart(4, "0")} — ${testOrder.customer_name}`,
);
console.log(`Karakter seti: encoding=${encoding} codepage=${codePage}`);

void (async () => {
	const warnings: PrinterEncodingWarning[] = [];
	try {
		await printReceiptWithRetry(testOrder, printerIp, {
			encoding,
			codePage,
			onWarning: (warning) => warnings.push(warning),
		});
		console.log("\n✓ Fiş başarıyla gönderildi.");
		console.log("  Yazıcıdan 2 kopya çıkmalı: ÇALIŞAN KOPYASI + MÜŞTERİ KOPYASI");
		if (warnings.length > 0) {
			console.warn("\n⚠ Karakter dönüşümü uyarıları:");
			for (const warning of warnings) {
				console.warn(
					`  - alan=${warning.field} original=${JSON.stringify(warning.original)} rendered=${JSON.stringify(warning.rendered)}`,
				);
			}
		}
	} catch (err) {
		const message = (err as Error).message ?? String(err);
		console.error("\n✗ Baskı başarısız:", message);

		if (message.includes("ECONNREFUSED")) {
			console.error("  → Yazıcı bağlantıyı reddetti. Port 9100 kapalı olabilir.");
			console.error("    Yazıcının açık olduğunu ve aynı ağda olduğunu kontrol edin.");
		} else if (message.includes("ETIMEDOUT") || message.includes("timeout")) {
			console.error("  → Bağlantı zaman aşımına uğradı. IP adresi yanlış olabilir.");
			console.error(`    Ping testi: ping ${printerIp}`);
		} else if (message.includes("ENOTFOUND") || message.includes("EHOSTUNREACH")) {
			console.error("  → Host bulunamadı. IP adresini kontrol edin.");
		}

		process.exit(1);
	}
})();
