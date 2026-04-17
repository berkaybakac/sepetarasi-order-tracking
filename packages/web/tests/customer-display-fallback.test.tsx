/** @vitest-environment jsdom */

import { type Order, OrderStatus, type WsMessage } from "@sepetarasi/shared";
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWebSocket } from "../src/hooks/useWebSocket";
import { api } from "../src/lib/api";
import { useOrderStore } from "../src/stores/orderStore";
import { CustomerDisplay } from "../src/views/display/CustomerDisplay";

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
		getStats: vi.fn(),
		getPublicSettings: vi.fn(),
	},
}));

function buildOrder(overrides: Partial<Order> = {}): Order {
	return {
		id: "display-order-1",
		business_date: "2026-04-17",
		display_no: 7,
		status: OrderStatus.PREPARING,
		terminal_id: "KASA-1",
		customer_name: "Display Musteri",
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

async function advance(ms: number) {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(ms);
		await Promise.resolve();
		await Promise.resolve();
	});
}

describe("Customer display polling fallback", () => {
	let container: HTMLDivElement;
	let root: Root;
	let socketOptions: MockedWebSocketOptions | null;

	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		vi.useFakeTimers();
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		socketOptions = null;

		useOrderStore.setState({
			orders: new Map(),
			stats: null,
			connected: false,
			loading: false,
			hasConnectedOnce: false,
			isHydrating: false,
			lastReconnectedAt: 0,
			lastSyncedAt: 0,
			nowPlaying: null,
		});

		vi.mocked(useWebSocket).mockImplementation((options) => {
			socketOptions = options as MockedWebSocketOptions;
			return { current: null };
		});
		vi.mocked(api.getPublicSettings).mockResolvedValue({});
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(async () => {
		await act(async () => {
			root.unmount();
		});
		container.remove();
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it("polls every 3 seconds while disconnected and stops after websocket reconnects", async () => {
		const preparingOrder = buildOrder();
		const readyOrder = buildOrder({
			status: OrderStatus.READY,
			ready_at: "2026-04-17T09:05:00.000Z",
			updated_at: "2026-04-17T09:05:00.000Z",
		});

		vi.mocked(api.listOrders)
			.mockResolvedValueOnce([preparingOrder])
			.mockResolvedValueOnce([readyOrder]);

		await act(async () => {
			root.render(
				<MemoryRouter initialEntries={["/display"]}>
					<CustomerDisplay />
				</MemoryRouter>,
			);
		});
		await flushEffects();

		expect(api.listOrders).toHaveBeenCalledTimes(1);

		await advance(3_000);
		expect(api.listOrders).toHaveBeenCalledTimes(2);
		expect(useOrderStore.getState().orders.get(preparingOrder.id)?.status).toBe(OrderStatus.READY);

		if (!socketOptions?.onConnect) {
			throw new Error("WebSocket callbacks were not captured");
		}

		await act(async () => {
			socketOptions.onConnect?.();
		});
		await flushEffects();

		await advance(9_000);
		expect(api.listOrders).toHaveBeenCalledTimes(2);
	});

	it("clears nowPlaying and refreshes immediately when a live websocket disconnects", async () => {
		const readyOrder = buildOrder({
			status: OrderStatus.READY,
			ready_at: "2026-04-17T09:05:00.000Z",
			updated_at: "2026-04-17T09:05:00.000Z",
		});

		vi.mocked(api.listOrders)
			.mockResolvedValueOnce([readyOrder])
			.mockResolvedValueOnce([readyOrder]);

		await act(async () => {
			root.render(
				<MemoryRouter initialEntries={["/display"]}>
					<CustomerDisplay />
				</MemoryRouter>,
			);
		});
		await flushEffects();

		useOrderStore.setState({
			nowPlaying: { order_id: readyOrder.id, display_no: readyOrder.display_no },
		});

		if (!socketOptions?.onConnect || !socketOptions.onDisconnect) {
			throw new Error("WebSocket callbacks were not captured");
		}

		await act(async () => {
			socketOptions.onConnect?.();
		});
		await flushEffects();

		await act(async () => {
			socketOptions.onDisconnect?.();
		});
		await flushEffects();

		expect(useOrderStore.getState().nowPlaying).toBeNull();
		expect(api.listOrders).toHaveBeenCalledTimes(2);
	});

	it("backs off polling after consecutive failures and resets to 3 seconds on success", async () => {
		const order = buildOrder();

		vi.mocked(api.listOrders)
			.mockResolvedValueOnce([order])
			.mockRejectedValueOnce(new Error("First poll failed"))
			.mockRejectedValueOnce(new Error("Second poll failed"))
			.mockResolvedValueOnce([order])
			.mockResolvedValueOnce([order]);

		await act(async () => {
			root.render(
				<MemoryRouter initialEntries={["/display"]}>
					<CustomerDisplay />
				</MemoryRouter>,
			);
		});
		await flushEffects();

		expect(api.listOrders).toHaveBeenCalledTimes(1);

		await advance(3_000);
		expect(api.listOrders).toHaveBeenCalledTimes(2);

		await advance(5_999);
		expect(api.listOrders).toHaveBeenCalledTimes(2);

		await advance(1);
		expect(api.listOrders).toHaveBeenCalledTimes(3);

		await advance(9_999);
		expect(api.listOrders).toHaveBeenCalledTimes(3);

		await advance(1);
		expect(api.listOrders).toHaveBeenCalledTimes(4);

		await advance(2_999);
		expect(api.listOrders).toHaveBeenCalledTimes(4);

		await advance(1);
		expect(api.listOrders).toHaveBeenCalledTimes(5);
	});
});
