import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
	getConfig: () => ipcRenderer.invoke("get-config"),
	saveConfig: (config: { serverUrl: string }) => ipcRenderer.invoke("save-config", config),
});
