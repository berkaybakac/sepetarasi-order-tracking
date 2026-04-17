/** @vitest-environment jsdom */

import { type Order, OrderStatus, type WsMessage } from "@sepetarasi/shared";
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KasaApp } from "../src/App";
import { useWebSocket } from "../src/hooks/useWebSocket";
import { ApiError, api } from "../src/lib/api";
import { useOrderStore } from "../src/stores/orderStore";

interface MockedWebSocketOptions {
	channel: string;
	onMessage: (msg: WsMessage) => void;
	onConnect?: () => void;
	onDisconnect?: () => void;
}

vi.mock("../src/hooks/useWebSocket", () => ({
	useWebSocket: vi.fn(),
}));

vi.mock("../src/lib/api", () => ({
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
		id: "order-1",
		business_date: "2026-04-17",
		display_no: 17,
		status: OrderStatus.PREPARING,
		terminal_id: "KASA-1",
		customer_name: "Zeynep",
		order_type: "Paket",
		target_minutes: null,
		notes: null,
		created_at: "2026-04-17T09:00:00.000Z",
		updated_at: "2026-04-17T09:00:00.000Z",
		ready_at: null,
		delivered_at: null,
		cancelled_at: null,
		items: [],
		...overrides,
	};
}

async function flushEffects() {
	await act(async () => {
		await Promise.resolve();
		await Promise.resolve();
	});
}

describe("Kasa restart recovery", () => {
	let container: HTMLDivElement;
	let root: Root;
	let socketOptions: MockedWebSocketOptions | null;

	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		socketOptions = null;

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
		vi.mocked(api.getPublicSettings).mockResolvedValue({});
		vi.mocked(api.verifyAdminPassword).mockResolvedValue(null);
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(async () => {
		await act(async () => {
			root.unmount();
		});
		container.remove();
		vi.restoreAllMocks();
	});

	it("reloads active orders from snapshot when startup hydrate failed but socket later connects", async () => {
		const recoveredOrder = buildOrder();

		vi.mocked(api.listOrders)
			.mockRejectedValueOnce(new Error("initial snapshot failed"))
			.mockResolvedValueOnce([recoveredOrder]);

		await act(async () => {
			root.render(<KasaApp onReconfigure={() => undefined} />);
		});
		await flushEffects();

		expect(api.listOrders).toHaveBeenCalledTimes(1);
		expect(container.textContent).toContain("Aktif sipariş yok");
		expect(container.textContent).not.toContain("Zeynep");

		if (!socketOptions?.onConnect) {
			throw new Error("WebSocket onConnect callback was not captured");
		}

		await act(async () => {
			socketOptions.onConnect?.();
		});
		await flushEffects();

		expect(api.listOrders).toHaveBeenCalledTimes(2);
		expect(useOrderStore.getState().orders.get(recoveredOrder.id)?.display_no).toBe(17);
		expect(container.textContent).toContain("Zeynep");
		expect(container.textContent).not.toContain("Aktif sipariş yok");
	});

	it("keeps retry-on-connect logic compatible with ApiError shape", async () => {
		const recoveredOrder = buildOrder({ id: "order-2", display_no: 18, customer_name: "Merve" });

		vi.mocked(api.listOrders)
			.mockRejectedValueOnce(new ApiError("HTTP_500", "Sunucu hatasi", 500))
			.mockResolvedValueOnce([recoveredOrder]);

		await act(async () => {
			root.render(<KasaApp onReconfigure={() => undefined} />);
		});
		await flushEffects();

		if (!socketOptions?.onConnect) {
			throw new Error("WebSocket onConnect callback was not captured");
		}

		await act(async () => {
			socketOptions.onConnect?.();
		});
		await flushEffects();

		expect(useOrderStore.getState().orders.get(recoveredOrder.id)?.customer_name).toBe("Merve");
		expect(container.textContent).toContain("Merve");
	});
});
