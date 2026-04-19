import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BrowserWindow, app, globalShortcut, ipcMain, nativeImage } from "electron";
import {
	type StructuredLogLevel,
	sanitizeLogValue,
	serializeLogError,
	summarizeTextChange,
} from "../src/lib/logging";
import { discoverServer } from "./discovery";
import { type PrinterEncodingWarning, printReceiptWithRetry } from "./printer";

interface KasaConfig {
	serverUrl: string;
	terminalId: string;
	terminalName: string;
	hotkey: string;
	printerIp: string;
	printerCodePage: number;
	printerEncoding: string;
	cashierToken: string;
}

interface StoredKasaConfig extends Partial<KasaConfig> {
	printerName?: string;
	printerCodepage?: number;
}

const DEFAULT_CONFIG: KasaConfig = {
	serverUrl: "http://sepetarasi.local:3000",
	terminalId: "KASA-1",
	terminalName: "Kasa 1",
	hotkey: "Ctrl+Shift+O",
	printerIp: "",
	printerCodePage: 61,
	printerEncoding: "cp857",
	cashierToken: "local-dev-cashier-token",
};

const KASA_EVENT_LOG_FILENAME = "kasa-events.log";

interface KasaLogRecord {
	timestamp: string;
	level: StructuredLogLevel;
	component: string;
	event: string;
	msg: string;
	context?: Record<string, unknown>;
}

interface RendererLogEnvelope {
	level: StructuredLogLevel;
	component: string;
	event: string;
	message: string;
	context?: Record<string, unknown>;
}

function normalizePrinterCodePage(value: unknown): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_CONFIG.printerCodePage;
	const n = Math.trunc(value);
	return Math.max(0, Math.min(255, n));
}

function normalizePrinterEncoding(value: unknown): string {
	if (typeof value !== "string") return DEFAULT_CONFIG.printerEncoding;
	const normalized = value.trim().toLowerCase();
	return normalized || DEFAULT_CONFIG.printerEncoding;
}

function getConfigPath(): string {
	return join(app.getPath("userData"), "config.json");
}

function getKasaEventLogPath(): string {
	const logDir = app.isReady() ? app.getPath("logs") : join(process.cwd(), "data");
	return join(logDir, KASA_EVENT_LOG_FILENAME);
}

function writeKasaLog(record: KasaLogRecord) {
	try {
		const logPath = getKasaEventLogPath();
		mkdirSync(dirname(logPath), { recursive: true });
		appendFileSync(logPath, `${JSON.stringify(record)}\n`);
	} catch (error) {
		console.error("Failed to write kasa structured log:", error);
	}
}

function logKasaEvent(
	level: StructuredLogLevel,
	component: string,
	event: string,
	msg: string,
	context?: Record<string, unknown>,
) {
	writeKasaLog({
		timestamp: new Date().toISOString(),
		level,
		component,
		event,
		msg,
		context: context ? (sanitizeLogValue(context) as Record<string, unknown>) : undefined,
	});
}

function isStructuredLogLevel(value: unknown): value is StructuredLogLevel {
	return value === "info" || value === "warn" || value === "error";
}

function normalizeRendererLogPayload(payload: unknown): RendererLogEnvelope | null {
	if (!payload || typeof payload !== "object") return null;

	const maybePayload = payload as {
		level?: StructuredLogLevel;
		component?: string;
		event?: string;
		message?: string;
		context?: Record<string, unknown>;
		error?: unknown;
	};

	return {
		level: isStructuredLogLevel(maybePayload.level) ? maybePayload.level : "error",
		component: typeof maybePayload.component === "string" ? maybePayload.component : "renderer",
		event: typeof maybePayload.event === "string" ? maybePayload.event : "renderer.log",
		message:
			typeof maybePayload.message === "string" ? maybePayload.message : "Renderer event forwarded",
		context: {
			source: "renderer",
			...(maybePayload.context ?? {}),
			...(maybePayload.error != null ? { error: maybePayload.error } : {}),
		},
	};
}

function loadConfig(): KasaConfig {
	try {
		const configPath = getConfigPath();
		if (existsSync(configPath)) {
			const saved = JSON.parse(readFileSync(configPath, "utf-8")) as StoredKasaConfig;
			const savedCodePage = saved.printerCodePage ?? saved.printerCodepage;
			const config: KasaConfig = {
				...DEFAULT_CONFIG,
				...saved,
				printerIp: saved.printerIp ?? saved.printerName ?? DEFAULT_CONFIG.printerIp,
				printerCodePage: normalizePrinterCodePage(savedCodePage),
				printerEncoding: normalizePrinterEncoding(saved.printerEncoding),
			};
			// One-time migration: printerName → printerIp. Persist so the old field is gone.
			if (
				(saved.printerName && !saved.printerIp) ||
				saved.printerCodepage !== undefined ||
				saved.printerCodePage !== config.printerCodePage ||
				saved.printerEncoding !== config.printerEncoding
			) {
				saveConfig(config);
			}
			return config;
		}
	} catch (err) {
		logKasaEvent("error", "config", "config.load_failed", "Failed to load kasa config", {
			error: serializeLogError(err),
		});
		console.error("Failed to load config, using defaults:", err);
	}
	return { ...DEFAULT_CONFIG };
}

function saveConfig(config: KasaConfig) {
	writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

function logPrintError(orderId: string, printerIp: string, message: string) {
	try {
		const logDir = app.getPath("logs");
		mkdirSync(logDir, { recursive: true });
		const entry = `[${new Date().toISOString()}] order=${orderId} printer=${printerIp} error=${message}\n`;
		appendFileSync(`${logDir}/print-errors.log`, entry);
	} catch {
		// ignore log write failures — don't mask the original error
	}

	logKasaEvent("error", "printer", "printer.print_failed", "Receipt print failed", {
		orderId,
		printerIp,
		errorMessage: message,
	});
}

function logPrintWarning(orderId: string, printerIp: string, warning: PrinterEncodingWarning) {
	const summary = summarizeTextChange(
		warning.field,
		warning.encoding,
		warning.codePage,
		warning.original,
		warning.rendered,
	);

	try {
		const logDir = app.getPath("logs");
		mkdirSync(logDir, { recursive: true });
		const entry =
			`[${new Date().toISOString()}] order=${orderId} printer=${printerIp} ` +
			`warning=${warning.type} field=${summary.field} encoding=${summary.encoding} codePage=${summary.codePage} ` +
			`originalLength=${summary.originalLength} renderedLength=${summary.renderedLength} changedCharacterCount=${summary.changedCharacterCount}\n`;
		appendFileSync(`${logDir}/print-warnings.log`, entry);
	} catch {
		// ignore log write failures — warnings should never block printing
	}

	logKasaEvent(
		"warn",
		"printer",
		"printer.charset_warning",
		"Receipt text required charset substitution",
		{
			orderId,
			printerIp,
			warningType: warning.type,
			...summary,
		},
	);
}

// Maps low-level Node.js network errors to user-facing Turkish messages.
// Technical detail stays in the log; kasiyer sees only actionable text.
function friendlyPrintError(err: unknown): string {
	const msg = err instanceof Error ? err.message : String(err);
	if (msg.includes("ECONNREFUSED"))
		return "Yazıcıya bağlanılamadı. Yazıcının açık olduğunu kontrol edin.";
	if (msg.includes("timeout") || msg.includes("ETIMEDOUT"))
		return "Yazıcı yanıt vermedi.";
	if (msg.includes("ENOTFOUND") || msg.includes("EADDRNOTAVAIL"))
		return "Yazıcı adresi bulunamadı. Ayarları kontrol edin.";
	if (msg.includes("ENETUNREACH") || msg.includes("EHOSTUNREACH"))
		return "Yazıcıya erişilemiyor. Ağ bağlantısını kontrol edin.";
	if (msg.includes("EPIPE") || msg.includes("ECONNRESET"))
		return "Yazıcı bağlantısı kesildi.";
	if (msg.includes("Unsupported printer encoding"))
		return "Yazıcı karakter seti ayarı geçersiz. Ayarlar'dan kontrol edin.";
	return "Yazıcı hatası oluştu.";
}

let mainWindow: BrowserWindow | null = null;

function resolveRuntimeIconPath(): string | null {
	const candidates = [
		join(app.getAppPath(), "build/icon.png"),
		join(__dirname, "../build/icon.png"),
		join(process.cwd(), "build/icon.png"),
		join(process.cwd(), "packages/kasa/build/icon.png"),
	];

	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			return candidate;
		}
	}

	return null;
}

function createWindow() {
	const runtimeIconPath = resolveRuntimeIconPath();

	mainWindow = new BrowserWindow({
		width: 1024,
		height: 768,
		minWidth: 800,
		minHeight: 600,
		icon: runtimeIconPath ?? undefined,
		title: "SEPET ARASI KASA",
		webPreferences: {
			preload: join(__dirname, "preload.js"),
			contextIsolation: true,
			nodeIntegration: false,
		},
	});

	if (process.platform === "darwin" && runtimeIconPath) {
		const dockIcon = nativeImage.createFromPath(runtimeIconPath);
		if (!dockIcon.isEmpty() && app.dock) {
			app.dock.setIcon(dockIcon);
		}
	}

	// Dev mode: load from Vite dev server
	if (process.env.VITE_DEV_SERVER_URL) {
		mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
	} else {
		mainWindow.loadFile(join(__dirname, "../dist/index.html"));
	}
}

// IPC handlers for config
ipcMain.handle("get-config", () => loadConfig());
ipcMain.handle("save-config", (_event, config: KasaConfig) => {
	saveConfig(config);
	return true;
});
ipcMain.handle("discover-server", () => discoverServer(loadConfig().serverUrl));
ipcMain.on("log-event", (_event, payload: unknown) => {
	const normalized = normalizeRendererLogPayload(payload);
	if (!normalized) return;

	logKasaEvent(
		normalized.level,
		normalized.component,
		normalized.event,
		normalized.message,
		normalized.context,
	);
});
ipcMain.handle("print-receipt", async (_event, order) => {
	const { printerIp, printerCodePage, printerEncoding } = loadConfig();
	const orderId =
		order && typeof order === "object" && "id" in order && typeof order.id === "string"
			? order.id
			: "unknown";
	if (!printerIp) {
		logKasaEvent(
			"warn",
			"printer",
			"printer.print_skipped_missing_ip",
			"Print attempted without configured printer IP",
			{ orderId },
		);
		console.warn("Print attempted but printerIp is not configured");
		return { ok: false, error: "Yazıcı ayarı yapılmamış — Ayarlar'dan IP adresini girin" };
	}
	try {
		await printReceiptWithRetry(order, printerIp, {
			codePage: printerCodePage,
			encoding: printerEncoding,
			onWarning: (warning) => {
				logPrintWarning(orderId, printerIp, warning);
				console.warn(
					`[printer][charset-warning] order=${orderId} field=${warning.field} encoding=${warning.encoding} codePage=${warning.codePage}`,
				);
			},
		});
		return { ok: true };
	} catch (err) {
		const raw = (err as Error).message;
		logPrintError(orderId, printerIp, raw);
		return { ok: false, error: friendlyPrintError(err) };
	}
});

function toggleWindow() {
	if (!mainWindow) return;
	if (mainWindow.isVisible() && mainWindow.isFocused()) {
		mainWindow.hide();
	} else {
		mainWindow.show();
		mainWindow.focus();
	}
}

function registerHotkey() {
	const config = loadConfig();
	// Convert "Ctrl+Shift+O" to Electron accelerator format (already compatible)
	const accelerator = config.hotkey || "Ctrl+Shift+O";
	try {
		globalShortcut.register(accelerator, toggleWindow);
	} catch (err) {
		logKasaEvent("error", "hotkey", "hotkey.register_failed", "Failed to register kasa hotkey", {
			accelerator,
			error: serializeLogError(err),
		});
		console.error("Failed to register hotkey:", err);
	}
}

app.whenReady().then(() => {
	createWindow();
	registerHotkey();
});

app.on("will-quit", () => {
	globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
	app.quit();
});

app.on("activate", () => {
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});
