/** @vitest-environment jsdom */

import {
	type Order,
	OrderStatus,
	WS_CHANNELS,
	WS_EVENTS,
	type WsMessage,
} from "@sepetarasi/shared";
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { useWebSocket } from "../src/hooks/useWebSocket";
import {
	api,
	setBaseUrl,
	setCashierToken,
	setTerminalId,
	verifyCashierToken,
} from "../src/lib/api";
import { useOrderStore } from "../src/stores/orderStore";

interface MockedWebSocketOptions {
	channel: string;
	onMessage: (msg: WsMessage) => void;
	onConnect?: () => void;
	onDisconnect?: () => void;
}

let mockedBaseUrl = "http://localhost:3000";

vi.mock("../src/hooks/useWebSocket", () => ({
	useWebSocket: vi.fn(),
}));

vi.mock("../src/lib/api", () => ({
	getBaseUrl: vi.fn(() => mockedBaseUrl),
	setBaseUrl: vi.fn((url: string) => {
		mockedBaseUrl = url;
	}),
	setTerminalId: vi.fn(),
	setCashierToken: vi.fn(),
	verifyCashierToken: vi.fn(),
	api: {
		listOrders: vi.fn(),
		createOrder: vi.fn(),
		changeStatus: vi.fn(),
		verifyAdminPassword: vi.fn(),
		getPublicSettings: vi.fn(),
	},
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

function buildOrder(overrides: Partial<Order> = {}): Order {
	return {
		id: "integration-order-1",
		business_date: "2026-04-19",
		display_no: 27,
		status: OrderStatus.PREPARING,
		terminal_id: "KASA-1",
		customer_name: "Ayşe",
		order_type: "Paket",
		target_minutes: null,
		notes: "Az acılı",
		created_at: "2026-04-19T10:00:00.000Z",
		updated_at: "2026-04-19T10:00:00.000Z",
		ready_at: null,
		delivered_at: null,
		cancelled_at: null,
		items: [],
		...overrides,
	};
}

async function click(element: HTMLElement) {
	await act(async () => {
		element.click();
	});
}

async function changeInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
	const prototype =
		input instanceof HTMLTextAreaElement
			? HTMLTextAreaElement.prototype
			: HTMLInputElement.prototype;
	const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
	if (!setter) {
		throw new Error("Input value setter not found");
	}

	await act(async () => {
		setter.call(input, value);
		input.dispatchEvent(new Event("input", { bubbles: true }));
	});
}

async function flushEffects(times = 4) {
	for (let index = 0; index < times; index += 1) {
		await act(async () => {
			await Promise.resolve();
		});
	}
}

async function waitFor(assertion: () => void, attempts = 30) {
	let lastError: unknown;
	for (let index = 0; index < attempts; index += 1) {
		try {
			assertion();
			return;
		} catch (error) {
			lastError = error;
			await flushEffects();
		}
	}

	throw lastError;
}

describe("Kasa app integration flow", () => {
	let container: HTMLDivElement;
	let root: Root;
	let socketOptions: MockedWebSocketOptions | null;

	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		socketOptions = null;
		mockedBaseUrl = "http://localhost:3000";

		useOrderStore.setState({
			orders: new Map(),
			connected: false,
			loading: false,
			error: null,
			hasConnectedOnce: false,
			isHydrating: false,
			lastReconnectedAt: 0,
		});

		vi.mocked(useWebSocket).mockImplementation((options) => {
			socketOptions = options as MockedWebSocketOptions;
			return { current: null };
		});
		vi.mocked(api.listOrders).mockResolvedValue([]);
		vi.mocked(api.getPublicSettings).mockResolvedValue({});
		vi.mocked(api.verifyAdminPassword).mockResolvedValue(null);
		vi.mocked(verifyCashierToken).mockResolvedValue(null);
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
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

	it("falls back to manual config, connects, and completes the create-and-print cashier flow", async () => {
		const initialConfig = {
			serverUrl: "http://sepetarasi.local:3000",
			terminalId: "KASA-1",
			terminalName: "Kasa 1",
			hotkey: "Ctrl+Shift+O",
			printerIp: "192.168.1.12",
			printerCodePage: 61,
			printerEncoding: "cp857",
			cashierToken: "cashier-secret",
			cashierTokensByServerUrl: {
				"http://localhost:3000": "local-dev-cashier-token",
				"http://sepetarasi.local:3000": "cashier-secret",
			},
		};
		const saveConfig = vi.fn().mockResolvedValue(true);
		const printReceipt = vi.fn().mockResolvedValue({ ok: true });
		const createdOrder = buildOrder();

		Object.defineProperty(window, "electronAPI", {
			value: {
				getConfig: vi.fn().mockResolvedValue(initialConfig),
				saveConfig,
				discoverServer: vi.fn().mockResolvedValue(null),
				printReceipt,
				logEvent: vi.fn(),
			},
			configurable: true,
			writable: true,
		});

		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValueOnce({
					json: vi.fn().mockResolvedValue({ ok: false }),
				})
				.mockResolvedValueOnce({
					json: vi.fn().mockResolvedValue({ ok: true }),
				}),
		);
		vi.mocked(api.createOrder).mockResolvedValue(createdOrder);

		await act(async () => {
			root.render(<App />);
		});

		await waitFor(() => {
			expect(container.textContent).toContain("Kasa ayarlarını yapılandırın");
		});

		await click(getButton("Bağlan"));

		await waitFor(() => {
			expect(container.textContent).toContain("Yeni Sipariş");
			expect(container.textContent).toContain("Aktif sipariş yok");
		});

		expect(setBaseUrl).toHaveBeenCalledWith("http://sepetarasi.local:3000");
		expect(setTerminalId).toHaveBeenCalledWith("KASA-1");
		expect(setCashierToken).toHaveBeenCalledWith("cashier-secret");
		expect(verifyCashierToken).toHaveBeenCalledWith(
			"http://sepetarasi.local:3000",
			"cashier-secret",
		);
		expect(saveConfig).toHaveBeenCalledWith(initialConfig);
		expect(socketOptions?.channel).toBe(WS_CHANNELS.ORDERS);

		await changeInputValue(getCustomerInput(), "Ayşe");
		await changeInputValue(getNotesTextarea(), "Az acılı");
		await click(getButton("Sipariş Ver"));
		await flushEffects();

		expect(api.createOrder).toHaveBeenCalledWith({
			customer_name: "Ayşe",
			order_type: "Paket",
			notes: "Az acılı",
		});
		expect(printReceipt).toHaveBeenCalledWith(
			expect.objectContaining({
				id: createdOrder.id,
				display_no: 27,
				customer_name: "Ayşe",
			}),
		);
		expect(getCustomerInput().value).toBe("");
		expect(getNotesTextarea().value).toBe("");

		if (!socketOptions?.onMessage) {
			throw new Error("WebSocket callbacks were not captured");
		}

		await act(async () => {
			socketOptions.onMessage({
				event: WS_EVENTS.ORDER_CREATED,
				data: createdOrder,
				timestamp: new Date().toISOString(),
			});
		});

		expect(useOrderStore.getState().orders.get(createdOrder.id)?.customer_name).toBe("Ayşe");
		expect(container.textContent).toContain("Ayşe");
	});

	it("uses LAN discovery to enter app mode when the saved server is unavailable", async () => {
		const initialConfig = {
			serverUrl: "http://10.0.0.50:3000",
			terminalId: "KASA-2",
			terminalName: "Kasa 2",
			hotkey: "Ctrl+Shift+O",
			printerIp: "",
			printerCodePage: 61,
			printerEncoding: "cp857",
			cashierToken: "cashier-secret",
			cashierTokensByServerUrl: {
				"http://10.0.0.50:3000": "cashier-secret",
			},
		};
		const discoveredUrl = "http://10.0.0.80:3000";
		const saveConfig = vi.fn().mockResolvedValue(true);
		const discoverServer = vi.fn().mockResolvedValue(discoveredUrl);

		Object.defineProperty(window, "electronAPI", {
			value: {
				getConfig: vi.fn().mockResolvedValue(initialConfig),
				saveConfig,
				discoverServer,
				printReceipt: vi.fn().mockResolvedValue({ ok: true }),
				logEvent: vi.fn(),
			},
			configurable: true,
			writable: true,
		});

		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				json: vi.fn().mockResolvedValue({ ok: false }),
			}),
		);

		await act(async () => {
			root.render(<App />);
		});

		await waitFor(() => {
			expect(container.textContent).toContain("Yeni Sipariş");
		});

		expect(discoverServer).toHaveBeenCalledTimes(1);
		expect(saveConfig).toHaveBeenCalledWith({
			...initialConfig,
			serverUrl: discoveredUrl,
		});
		expect(vi.mocked(setBaseUrl).mock.calls.at(-1)?.[0]).toBe(discoveredUrl);
		expect(container.textContent).not.toContain("Kasa ayarlarını yapılandırın");
	});

	function getButton(label: string) {
		const button = Array.from(container.querySelectorAll("button")).find(
			(node) => node.textContent?.replace(/\s+/g, " ").trim() === label,
		);
		if (!(button instanceof HTMLButtonElement)) {
			throw new Error(`Button not found: ${label}`);
		}
		return button;
	}

	function getCustomerInput() {
		const input = container.querySelector("#customer-name");
		if (!(input instanceof HTMLInputElement)) {
			throw new Error("Customer name input not found");
		}
		return input;
	}

	function getNotesTextarea() {
		const textarea = container.querySelector("#order-notes");
		if (!(textarea instanceof HTMLTextAreaElement)) {
			throw new Error("Notes textarea not found");
		}
		return textarea;
	}
});
