#!/usr/bin/env tsx
/**
 * Karakter seti karşılaştırmalı fiş test scripti.
 *
 * Kullanım:
 *   npx tsx scripts/test-print-charset.ts <printer-ip>
 *   npx tsx scripts/test-print-charset.ts <printer-ip> --profiles cp857:61,cp1254:24
 */
import {
	type PrinterEncodingWarning,
	printReceiptWithRetry,
} from "../packages/kasa/electron/printer.ts";

interface Profile {
	encoding: string;
	codePage: number;
}

function readArg(args: string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	if (index === -1) return undefined;
	return args[index + 1];
}

function parseProfiles(raw?: string): Profile[] {
	if (!raw) {
		return [
			{ encoding: "cp857", codePage: 61 },
			{ encoding: "cp1254", codePage: 24 },
		];
	}

	const parsed = raw
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean)
		.map((item) => {
			const [encodingRaw, codePageRaw] = item.split(":");
			const encoding = encodingRaw?.trim().toLowerCase();
			const codePage = Number.parseInt(codePageRaw ?? "", 10);
			if (!encoding || Number.isNaN(codePage) || codePage < 0 || codePage > 255) {
				throw new Error(`Geçersiz profil: ${item}`);
			}
			return { encoding, codePage };
		});

	if (parsed.length === 0) {
		throw new Error("En az bir profil gerekli.");
	}
	return parsed;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const args = process.argv.slice(2);
const printerIp = args[0];
const profilesArg = readArg(args, "--profiles");

if (!printerIp) {
	console.error("Hata: Yazıcı IP adresi gerekli.");
	console.error(
		"Kullanım: npx tsx scripts/test-print-charset.ts <printer-ip> [--profiles cp857:61,cp1254:24]",
	);
	process.exit(1);
}

let profiles: Profile[];
try {
	profiles = parseProfiles(profilesArg);
} catch (err) {
	console.error((err as Error).message);
	process.exit(1);
}

console.log(`Yazıcı: ${printerIp}:9100`);
console.log("Profiller:");
for (const profile of profiles) {
	console.log(`  - encoding=${profile.encoding} codepage=${profile.codePage}`);
}

void (async () => {
	for (const [index, profile] of profiles.entries()) {
		const warnings: PrinterEncodingWarning[] = [];
		const order = {
			display_no: 900 + index,
			customer_name: `Charset Test ${index + 1}`,
			order_type: `${profile.encoding}/${profile.codePage}`,
			notes: "Türkçe: ÇçĞğİıÖöŞşÜü | Noktalama: — – “ ” ‘ ’ …",
			created_at: new Date().toISOString(),
		};

		console.log(`\n[TEST ${index + 1}] encoding=${profile.encoding} codepage=${profile.codePage}`);
		try {
			await printReceiptWithRetry(order, printerIp, {
				encoding: profile.encoding,
				codePage: profile.codePage,
				onWarning: (warning) => warnings.push(warning),
			});
			console.log("  OK: fiş gönderildi.");
			if (warnings.length > 0) {
				console.log("  Uyarılar:");
				for (const warning of warnings) {
					console.log(
						`    - alan=${warning.field} original=${JSON.stringify(warning.original)} rendered=${JSON.stringify(warning.rendered)}`,
					);
				}
			} else {
				console.log("  Uyarı yok.");
			}
		} catch (err) {
			console.error(`  Hata: ${(err as Error).message ?? String(err)}`);
		}

		// Printers on LAN can drop packets if jobs are sent back-to-back too quickly.
		await sleep(350);
	}

	console.log("\nBitti. Kağıttan karakter kalitesini karşılaştırıp doğru profili seçebilirsiniz.");
})();
