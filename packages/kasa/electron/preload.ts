import { contextBridge, ipcRenderer } from "electron";

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

interface PrintReceiptResult {
	ok: boolean;
	error?: string;
}

interface RendererLogPayload {
	level?: "info" | "warn" | "error";
	component: string;
	event: string;
	message: string;
	context?: Record<string, unknown>;
	error?: unknown;
}

contextBridge.exposeInMainWorld("electronAPI", {
	getConfig: () => ipcRenderer.invoke("get-config") as Promise<KasaConfig>,
	saveConfig: (config: KasaConfig) => ipcRenderer.invoke("save-config", config),
	discoverServer: () => ipcRenderer.invoke("discover-server") as Promise<string | null>,
	printReceipt: (order: unknown) =>
		ipcRenderer.invoke("print-receipt", order) as Promise<PrintReceiptResult>,
	logEvent: (payload: RendererLogPayload) => ipcRenderer.send("log-event", payload),
});
