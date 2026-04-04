import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BrowserWindow, app, globalShortcut, ipcMain } from "electron";

interface KasaConfig {
	serverUrl: string;
	terminalId: string;
	terminalName: string;
	hotkey: string;
	printerName: string;
}

const DEFAULT_CONFIG: KasaConfig = {
	serverUrl: "http://localhost:3000",
	terminalId: "KASA-1",
	terminalName: "Kasa 1",
	hotkey: "Ctrl+Shift+O",
	printerName: "",
};

const CONFIG_PATH = join(app.getPath("userData"), "config.json");

function loadConfig(): KasaConfig {
	try {
		if (existsSync(CONFIG_PATH)) {
			const saved = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
			return { ...DEFAULT_CONFIG, ...saved };
		}
	} catch (err) {
		console.error("Failed to load config, using defaults:", err);
	}
	return { ...DEFAULT_CONFIG };
}

function saveConfig(config: KasaConfig) {
	writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

let mainWindow: BrowserWindow | null = null;

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1024,
		height: 768,
		minWidth: 800,
		minHeight: 600,
		title: "Sepetarasi Kasa",
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
