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
const MAX_ESC_POS_CODEPAGE = 255;

const DEFAULT_PRINTER_ENCODING = "cp857";
const DEFAULT_ESC_POS_CODEPAGE = 61;

const FALLBACK_CHAR_MAP: Record<string, string> = {
	"—": "-",
	"–": "-",
	"“": '"',
	"”": '"',
	"‘": "'",
	"’": "'",
	"…": "...",
	"\u00a0": " ",
};

export interface PrinterEncodingWarning {
	type: "CHARSET_SUBSTITUTION";
	field: string;
	original: string;
	rendered: string;
	encoding: string;
	codePage: number;
}

export interface PrinterOptions {
	codePage?: number;
	encoding?: string;
	transliterateUnsupportedChars?: boolean;
	onWarning?: (warning: PrinterEncodingWarning) => void;
}

interface ResolvedPrinterOptions {
	codePage: number;
	encoding: string;
	transliterateUnsupportedChars: boolean;
	onWarning?: (warning: PrinterEncodingWarning) => void;
}

interface BuildState {
	options: ResolvedPrinterOptions;
	seenWarningKeys: Set<string>;
}

const CMD = {
	INIT: Buffer.from([ESC, 0x40]),
	ALIGN_CENTER: Buffer.from([ESC, 0x61, 1]),
	ALIGN_LEFT: Buffer.from([ESC, 0x61, 0]),
	BOLD_ON: Buffer.from([ESC, 0x45, 1]),
	BOLD_OFF: Buffer.from([ESC, 0x45, 0]),
	DOUBLE_STRIKE_ON: Buffer.from([ESC, 0x47, 1]),
	DOUBLE_STRIKE_OFF: Buffer.from([ESC, 0x47, 0]),
	// GS ! n => char size (width x height). 0x00=1x1, 0x01=1x2, 0x22=3x3.
	SIZE_NORMAL: Buffer.from([GS, 0x21, 0x00]),
	SIZE_MEDIUM: Buffer.from([GS, 0x21, 0x01]),
	SIZE_NUMBER_XL: Buffer.from([GS, 0x21, 0x22]),
	LF: Buffer.from([0x0a]),
	// Feed 4 lines then full cut — ensures last lines clear the cutter blade
	FEED_AND_CUT: Buffer.from([ESC, 0x64, 4, GS, 0x56, 0x00]),
};

const RECEIPT_WIDTH = 32;
const RECEIPT_TIMEZONE = "Europe/Istanbul";
// How long to wait after writing before closing the socket.
// Two-copy receipts on a slow network (RPi4) need more than 200ms.
const PRINT_DRAIN_MS = 500;
// Connection + write timeout. Allows for slow/sleeping printers on LAN.
const SOCKET_TIMEOUT_MS = 10_000;

function sanitizeCodePage(codePage?: number): number {
	if (typeof codePage !== "number" || !Number.isFinite(codePage)) return DEFAULT_ESC_POS_CODEPAGE;
	const n = Math.trunc(codePage);
	return Math.max(0, Math.min(MAX_ESC_POS_CODEPAGE, n));
}

function normalizeEncoding(encoding?: string): string {
	const normalized = encoding?.trim().toLowerCase();
	return normalized ? normalized : DEFAULT_PRINTER_ENCODING;
}

function ensureEncodingSupported(encoding: string) {
	try {
		iconv.encode("Türkçe test", encoding);
	} catch {
		throw new Error(`Unsupported printer encoding: ${encoding}`);
	}
}

function resolvePrinterOptions(options?: PrinterOptions): ResolvedPrinterOptions {
	const resolved: ResolvedPrinterOptions = {
		codePage: sanitizeCodePage(options?.codePage),
		encoding: normalizeEncoding(options?.encoding),
		transliterateUnsupportedChars: options?.transliterateUnsupportedChars ?? true,
		onWarning: options?.onWarning,
	};
	ensureEncodingSupported(resolved.encoding);
	return resolved;
}

function codePageCommand(codePage: number): Buffer {
	return Buffer.from([ESC, 0x74, sanitizeCodePage(codePage)]);
}

function transliterateUnsupportedChars(text: string): string {
	let output = text;
	for (const [from, to] of Object.entries(FALLBACK_CHAR_MAP)) {
		output = output.split(from).join(to);
	}
	return output;
}

function emitEncodingWarning(state: BuildState, warning: PrinterEncodingWarning) {
	const key = `${warning.field}|${warning.original}|${warning.rendered}|${warning.encoding}|${warning.codePage}`;
	if (state.seenWarningKeys.has(key)) return;
	state.seenWarningKeys.add(key);

	if (state.options.onWarning) {
		state.options.onWarning(warning);
		return;
	}

	console.warn(
		`[printer][charset-warning] field=${warning.field} encoding=${warning.encoding} codePage=${warning.codePage} original=${JSON.stringify(warning.original)} rendered=${JSON.stringify(warning.rendered)}`,
	);
}

function toPrintableText(state: BuildState, field: string, text: string): string {
	const transliterated = state.options.transliterateUnsupportedChars
		? transliterateUnsupportedChars(text)
		: text;
	const rendered = iconv.decode(
		iconv.encode(transliterated, state.options.encoding),
		state.options.encoding,
	);

	if (rendered !== text) {
		emitEncodingWarning(state, {
			type: "CHARSET_SUBSTITUTION",
			field,
			original: text,
			rendered,
			encoding: state.options.encoding,
			codePage: state.options.codePage,
		});
	}

	return rendered;
}

function encodeLine(state: BuildState, text: string): Buffer {
	return iconv.encode(text, state.options.encoding);
}

function line(state: BuildState, text: string): Buffer {
	return Buffer.concat([encodeLine(state, text), CMD.LF]);
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

function buildReceipt(order: PrintOrder, copyLabel: string, state: BuildState): Buffer {
	const displayNo = String(order.display_no).padStart(4, "0");
	const customerName = order.customer_name ?? "";
	const orderType = order.order_type ?? "";
	const notes = order.notes?.trim();
	const timeStr = formatTime(order.created_at);

	const parts: Buffer[] = [
		CMD.INIT,
		codePageCommand(state.options.codePage),
		// Top margin
		CMD.LF,
		CMD.LF,
		CMD.ALIGN_CENTER,
		// Copy label — medium (double-height) + bold
		CMD.SIZE_MEDIUM,
		CMD.BOLD_ON,
		CMD.DOUBLE_STRIKE_ON,
		line(state, toPrintableText(state, "copy_label", copyLabel)),
		CMD.DOUBLE_STRIKE_OFF,
		CMD.BOLD_OFF,
		CMD.SIZE_NORMAL,
		separator(state),
		// Order number — extra large + bold + double-strike for max readability.
		CMD.SIZE_NUMBER_XL,
		CMD.BOLD_ON,
		CMD.DOUBLE_STRIKE_ON,
		line(state, toPrintableText(state, "display_no", displayNo)),
		CMD.DOUBLE_STRIKE_OFF,
		CMD.BOLD_OFF,
		CMD.SIZE_NORMAL,
		separator(state),
		// Order type — medium (double-height), centered, no label prefix
		CMD.SIZE_MEDIUM,
		CMD.BOLD_ON,
		line(state, toPrintableText(state, "order_type", orderType)),
		CMD.BOLD_OFF,
		CMD.SIZE_NORMAL,
		separator(state),
		CMD.ALIGN_LEFT,
		// Body fields in bold for darker printing
		CMD.BOLD_ON,
	];

	pushWrappedLines(state, parts, `Müşteri: ${customerName}`, "customer_name");
	pushWrappedLines(state, parts, `Saat:    ${timeStr}`, "created_at");
	parts.push(CMD.BOLD_OFF);

	if (notes) {
		parts.push(separator(state));
		parts.push(CMD.BOLD_ON);
		pushWrappedLines(state, parts, `Not: ${notes}`, "notes");
		parts.push(CMD.BOLD_OFF);
	}

	parts.push(separator(state));
	// Bottom margin + cutter clearance (symmetric with top 2 LF)
	parts.push(CMD.FEED_AND_CUT);

	return Buffer.concat(parts);
}

function separator(state: BuildState): Buffer {
	return line(state, "-".repeat(RECEIPT_WIDTH));
}

function pushWrappedLines(state: BuildState, parts: Buffer[], text: string, field: string) {
	const printableText = toPrintableText(state, field, text);
	for (const segment of wrapText(printableText, RECEIPT_WIDTH)) {
		parts.push(line(state, segment));
	}
}

function wrapText(text: string, maxLength: number): string[] {
	const normalized = text.trim().replace(/\s+/g, " ");
	if (!normalized) return [];

	const words = normalized.split(" ");
	const lines: string[] = [];
	let current = "";

	for (const word of words) {
		if (word.length > maxLength) {
			if (current) {
				lines.push(current);
				current = "";
			}
			for (let i = 0; i < word.length; i += maxLength) {
				lines.push(word.slice(i, i + maxLength));
			}
			continue;
		}

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

export function buildReceiptDocument(order: PrintOrder, options?: PrinterOptions): Buffer {
	const state: BuildState = {
		options: resolvePrinterOptions(options),
		seenWarningKeys: new Set(),
	};
	return Buffer.concat([
		buildReceipt(order, "ÇALIŞAN KOPYASI", state),
		buildReceipt(order, "MÜŞTERİ KOPYASI", state),
	]);
}

const RETRY_DELAYS_MS = [500, 1000, 2000];

export function isRetryablePrintError(err: unknown): boolean {
	const message = err instanceof Error ? err.message : String(err);
	return (
		message.includes("ECONNREFUSED") ||
		message.includes("ETIMEDOUT") ||
		message.includes("timeout") ||
		message.includes("ENOTFOUND") ||
		message.includes("EADDRNOTAVAIL") ||
		message.includes("ENETUNREACH") ||
		message.includes("EHOSTUNREACH") ||
		message.includes("EPIPE") ||
		message.includes("ECONNRESET")
	);
}

export async function printReceiptWithRetry(
	order: PrintOrder,
	printerIp: string,
	options?: PrinterOptions,
): Promise<void> {
	for (const delay of RETRY_DELAYS_MS) {
		try {
			return await printReceipt(order, printerIp, options);
		} catch (err) {
			if (!isRetryablePrintError(err)) {
				throw err;
			}
			await new Promise((r) => setTimeout(r, delay));
		}
	}
	return printReceipt(order, printerIp, options); // final attempt — let error propagate
}

function printReceipt(
	order: PrintOrder,
	printerIp: string,
	options?: PrinterOptions,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const receipt = buildReceiptDocument(order, options);

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
