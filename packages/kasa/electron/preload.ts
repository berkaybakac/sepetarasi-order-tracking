import { contextBridge, ipcRenderer } from "electron";

interface KasaConfig {
	serverUrl: string;
	terminalId: string;
	terminalName: string;
	hotkey: string;
	printerName: string;
	cashierToken: string;
}

contextBridge.exposeInMainWorld("electronAPI", {
	getConfig: () => ipcRenderer.invoke("get-config") as Promise<KasaConfig>,
	saveConfig: (config: KasaConfig) => ipcRenderer.invoke("save-config", config),
	discoverServer: () => ipcRenderer.invoke("discover-server") as Promise<string | null>,
});
