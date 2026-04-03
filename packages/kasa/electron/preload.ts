import { contextBridge, ipcRenderer } from "electron";

interface KasaConfig {
	serverUrl: string;
	terminalId: string;
	terminalName: string;
	hotkey: string;
	printerName: string;
}

contextBridge.exposeInMainWorld("electronAPI", {
	getConfig: () => ipcRenderer.invoke("get-config") as Promise<KasaConfig>,
	saveConfig: (config: KasaConfig) => ipcRenderer.invoke("save-config", config),
});
