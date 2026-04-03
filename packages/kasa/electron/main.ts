import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const CONFIG_PATH = join(app.getPath("userData"), "config.json");

function loadConfig(): { serverUrl: string } {
	try {
		if (existsSync(CONFIG_PATH)) {
			return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
		}
	} catch {
		// ignore
	}
	return { serverUrl: "http://localhost:3000" };
}

function saveConfig(config: { serverUrl: string }) {
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
ipcMain.handle("save-config", (_event, config: { serverUrl: string }) => {
	saveConfig(config);
	return true;
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
	app.quit();
});

app.on("activate", () => {
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});
