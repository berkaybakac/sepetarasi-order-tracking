import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BrowserWindow, app, globalShortcut, ipcMain } from "electron";
import { discoverServer } from "./discovery";
import { printReceiptWithRetry } from "./printer";

interface KasaConfig {
	serverUrl: string;
	terminalId: string;
	terminalName: string;
	hotkey: string;
	printerIp: string;
	cashierToken: string;
}

interface StoredKasaConfig extends Partial<KasaConfig> {
	printerName?: string;
}

const DEFAULT_CONFIG: KasaConfig = {
	serverUrl: "http://sepetarasi.local:3000",
	terminalId: "KASA-1",
	terminalName: "Kasa 1",
	hotkey: "Ctrl+Shift+O",
	printerIp: "",
	cashierToken: "local-dev-cashier-token",
};

function getConfigPath(): string {
	return join(app.getPath("userData"), "config.json");
}

function loadConfig(): KasaConfig {
	try {
		const configPath = getConfigPath();
		if (existsSync(configPath)) {
			const saved = JSON.parse(readFileSync(configPath, "utf-8")) as StoredKasaConfig;
			const config: KasaConfig = {
				...DEFAULT_CONFIG,
				...saved,
				printerIp: saved.printerIp ?? saved.printerName ?? DEFAULT_CONFIG.printerIp,
			};
			// One-time migration: printerName → printerIp. Persist so the old field is gone.
			if (saved.printerName && !saved.printerIp) {
				saveConfig(config);
			}
			return config;
		}
	} catch (err) {
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
}

// Maps low-level Node.js network errors to user-facing Turkish messages.
// Technical detail stays in the log; kasiyer sees only actionable text.
function friendlyPrintError(err: unknown): string {
	const msg = err instanceof Error ? err.message : String(err);
	if (msg.includes("ECONNREFUSED"))
		return "Yazıcıya bağlanılamadı — yazıcının açık olduğunu kontrol edin";
	if (msg.includes("timeout") || msg.includes("ETIMEDOUT"))
		return "Yazıcı yanıt vermedi — tekrar deneyin";
	if (msg.includes("ENOTFOUND") || msg.includes("EADDRNOTAVAIL"))
		return "Yazıcı adresi bulunamadı — ayarları kontrol edin";
	if (msg.includes("ENETUNREACH") || msg.includes("EHOSTUNREACH"))
		return "Yazıcıya erişilemiyor — ağ bağlantısını kontrol edin";
	if (msg.includes("EPIPE") || msg.includes("ECONNRESET"))
		return "Yazıcı bağlantısı kesildi — tekrar deneyin";
	return "Yazıcı hatası — tekrar deneyin";
}

let mainWindow: BrowserWindow | null = null;

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1024,
		height: 768,
		minWidth: 800,
		minHeight: 600,
		title: "SEPET ARASI KASA",
		webPreferences: {
			preload: join(__dirname, "preload.js"),
			contextIsolation: true,
			nodeIntegration: false,
		},
	});

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
ipcMain.handle("print-receipt", async (_event, order) => {
	const { printerIp } = loadConfig();
	if (!printerIp) {
		console.warn("Print attempted but printerIp is not configured");
		return { ok: false, error: "Yazıcı ayarı yapılmamış — Ayarlar'dan IP adresini girin" };
	}
	try {
		await printReceiptWithRetry(order, printerIp);
		return { ok: true };
	} catch (err) {
		const raw = (err as Error).message;
		logPrintError(order.id ?? "unknown", printerIp, raw);
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
