import type { Order } from "@sepetarasi/shared";
import { type StructuredLogLevel, sanitizeLogValue, serializeLogError } from "./logging";

export interface KasaConfig {
	serverUrl: string;
	terminalId: string;
	terminalName: string;
	hotkey: string;
	printerIp: string;
	printerCodePage: number;
	printerEncoding: string;
	cashierToken: string;
}

export interface PrintReceiptResult {
	ok: boolean;
	error?: string;
}

export interface RendererLogPayload {
	level?: StructuredLogLevel;
	component: string;
	event: string;
	message: string;
	context?: Record<string, unknown>;
	error?: unknown;
}

interface ElectronAPI {
	getConfig: () => Promise<KasaConfig>;
	saveConfig: (config: KasaConfig) => Promise<boolean>;
	discoverServer: () => Promise<string | null>;
	printReceipt: (order: Order) => Promise<PrintReceiptResult>;
	logEvent: (payload: RendererLogPayload) => void;
}

declare global {
	interface Window {
		electronAPI?: ElectronAPI;
	}
}

function normalizeRendererPayload(payload: RendererLogPayload): RendererLogPayload {
	return {
		level: payload.level ?? "error",
		component: payload.component,
		event: payload.event,
		message: payload.message,
		context: sanitizeLogValue({
			locationPath: location.pathname,
			...payload.context,
		}) as Record<string, unknown>,
		error: serializeLogError(payload.error),
	};
}

export function getElectronAPI() {
	if (typeof window === "undefined") return undefined;
	return window.electronAPI;
}

export function logRendererEvent(payload: RendererLogPayload) {
	getElectronAPI()?.logEvent(normalizeRendererPayload(payload));
}

export function reportRendererError(payload: Omit<RendererLogPayload, "level">) {
	console.error(payload.message, payload.error);
	logRendererEvent({ ...payload, level: "error" });
}

export function reportRendererWarning(payload: Omit<RendererLogPayload, "level">) {
	console.warn(payload.message, payload.error ?? payload.context);
	logRendererEvent({ ...payload, level: "warn" });
}
