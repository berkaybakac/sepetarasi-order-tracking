/** @vitest-environment jsdom */

import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { useOrderStore } from "../src/stores/orderStore";

vi.mock("../src/hooks/useWebSocket", () => ({
	useWebSocket: vi.fn(),
}));

vi.mock("../src/lib/api", () => ({
	getBaseUrl: vi.fn(() => "http://localhost:3000"),
	api: {
		listOrders: vi.fn().mockResolvedValue([]),
		getPublicSettings: vi.fn().mockResolvedValue({}),
		createOrder: vi.fn(),
		changeStatus: vi.fn(),
		verifyAdminPassword: vi.fn(),
	},
	setBaseUrl: vi.fn(),
	setCashierToken: vi.fn(),
	setTerminalId: vi.fn(),
	ApiError: class ApiError extends Error {
		code: string;
		statusCode: number;

		constructor(code: string, message: string, statusCode: number) {
			super(message);
			this.name = "ApiError";
			this.code = code;
			this.statusCode = statusCode;
		}
	},
}));

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

describe("Kasa App startup", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		useOrderStore.setState({
			orders: new Map(),
			connected: false,
			loading: false,
			error: null,
			hasConnectedOnce: false,
			isHydrating: false,
			lastReconnectedAt: 0,
		});

		Object.defineProperty(window, "electronAPI", {
			value: undefined,
			configurable: true,
			writable: true,
		});
	});

	afterEach(async () => {
		await act(async () => {
			root.unmount();
		});
		container.remove();
		window.electronAPI = undefined;
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it("keeps a startup loading screen visible while the initial health check is pending", async () => {
		const healthCheck = deferred<{ json: () => Promise<{ ok: boolean }> }>();
		vi.stubGlobal(
			"fetch",
			vi.fn().mockImplementation(() => healthCheck.promise),
		);

		await act(async () => {
			root.render(<App />);
		});

		expect(container.textContent).toContain("Bağlantı kontrol ediliyor...");
		expect(container.textContent).not.toContain("Kasa ayarlarını yapılandırın");

		await act(async () => {
			healthCheck.resolve({
				json: vi.fn().mockResolvedValue({ ok: false }),
			});
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(container.textContent).toContain("Kasa ayarlarını yapılandırın");
	});
});
