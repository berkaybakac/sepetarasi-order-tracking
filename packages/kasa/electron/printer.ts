import * as net from "node:net";
import iconv from "iconv-lite";

interface PrintOrder {
	display_no: number;
	customer_name: string | null;
	order_type: string | null;
	notes: string | null;
	created_at: string;
}

// ESC/POS command bytes
const ESC = 0x1b;
const GS = 0x1d;

const CMD = {
	INIT: Buffer.from([ESC, 0x40]),
	// PC857 Turkish code page (code 61)
	CODEPAGE_PC857: Buffer.from([ESC, 0x74, 61]),
	ALIGN_CENTER: Buffer.from([ESC, 0x61, 1]),
	ALIGN_LEFT: Buffer.from([ESC, 0x61, 0]),
	BOLD_ON: Buffer.from([ESC, 0x45, 1]),
	BOLD_OFF: Buffer.from([ESC, 0x45, 0]),
	// Double height + double width
	FONT_BIG: Buffer.from([ESC, 0x21, 0x30]),
	FONT_NORMAL: Buffer.from([ESC, 0x21, 0x00]),
	LF: Buffer.from([0x0a]),
	// Full cut
	CUT: Buffer.from([GS, 0x56, 0x00]),
};

const RECEIPT_WIDTH = 32;
const RECEIPT_TIMEZONE = "Europe/Istanbul";
// How long to wait after writing before closing the socket.
// Two-copy receipts on a slow network (RPi4) need more than 200ms.
const PRINT_DRAIN_MS = 500;
// Connection + write timeout. Allows for slow/sleeping printers on LAN.
const SOCKET_TIMEOUT_MS = 10_000;

function encode(text: string): Buffer {
	return iconv.encode(text, "cp857");
}

function line(text: string): Buffer {
	return Buffer.concat([encode(text), CMD.LF]);
}

function formatTime(isoString: string): string {
	return new Intl.DateTimeFormat("tr-TR", {
		timeZone: RECEIPT_TIMEZONE,
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(new Date(isoString));
}

function buildReceipt(order: PrintOrder, copyLabel: string): Buffer {
	const displayNo = String(order.display_no).padStart(4, "0");
	const customerName = order.customer_name ?? "";
	const orderType = order.order_type ?? "";
	const timeStr = formatTime(order.created_at);

	const parts: Buffer[] = [
		CMD.INIT,
		CMD.CODEPAGE_PC857,
		CMD.LF,
		CMD.ALIGN_CENTER,
		CMD.BOLD_ON,
		line(copyLabel),
		CMD.BOLD_OFF,
		CMD.FONT_BIG,
		line(displayNo),
		CMD.FONT_NORMAL,
		CMD.LF,
		CMD.ALIGN_LEFT,
	];

	pushWrappedLines(parts, `Müşteri: ${customerName}`);
	pushWrappedLines(parts, `Tip: ${orderType}`);
	pushWrappedLines(parts, `Saat: ${timeStr}`);

	if (order.notes) {
		pushWrappedLines(parts, `Not: ${order.notes.trim()}`);
	}

	parts.push(CMD.LF);
	parts.push(CMD.CUT);

	return Buffer.concat(parts);
}

function pushWrappedLines(parts: Buffer[], text: string) {
	for (const segment of wrapText(text, RECEIPT_WIDTH)) {
		parts.push(line(segment));
	}
}

function wrapText(text: string, maxLength: number): string[] {
	const normalized = text.trim().replace(/\s+/g, " ");
	if (!normalized) return [];

	const words = normalized.split(" ");
	const lines: string[] = [];
	let current = "";

	for (const word of words) {
		if (!current) {
			current = word;
			continue;
		}

		const candidate = `${current} ${word}`;
		if (candidate.length <= maxLength) {
			current = candidate;
			continue;
		}

		lines.push(current);
		current = word;
	}

	if (current) {
		lines.push(current);
	}

	return lines;
}

export function buildReceiptDocument(order: PrintOrder): Buffer {
	return Buffer.concat([
		buildReceipt(order, "ÇALIŞAN KOPYASI"),
		buildReceipt(order, "MÜŞTERİ KOPYASI"),
	]);
}

const RETRY_DELAYS_MS = [500, 1000, 2000];

export async function printReceiptWithRetry(order: PrintOrder, printerIp: string): Promise<void> {
	for (const delay of RETRY_DELAYS_MS) {
		try {
			return await printReceipt(order, printerIp);
		} catch {
			await new Promise((r) => setTimeout(r, delay));
		}
	}
	return printReceipt(order, printerIp); // final attempt — let error propagate
}

function printReceipt(order: PrintOrder, printerIp: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const receipt = buildReceiptDocument(order);

		const socket = net.createConnection({ host: printerIp, port: 9100 }, () => {
			socket.write(receipt, (err) => {
				if (err) {
					socket.destroy();
					reject(err);
					return;
				}
				// Give the printer a moment to process before closing
				setTimeout(() => {
					socket.end();
					resolve();
				}, PRINT_DRAIN_MS);
			});
		});

		socket.setTimeout(SOCKET_TIMEOUT_MS);
		socket.on("timeout", () => {
			socket.destroy();
			reject(new Error(`Printer timeout: ${printerIp}:9100`));
		});
		socket.on("error", (err) => {
			reject(err);
		});
	});
}
