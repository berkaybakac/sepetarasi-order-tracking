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

function getColumnCount(container: HTMLDivElement, title: string): string {
	const heading = Array.from(container.querySelectorAll("h2")).find(
		(node) => node.textContent === title,
	);
	if (!(heading instanceof HTMLHeadingElement)) {
		throw new Error(`Column heading not found: ${title}`);
	}

	const header = heading.parentElement;
	const count = header?.querySelector("span");
	if (!(count instanceof HTMLSpanElement)) {
		throw new Error(`Column count not found for: ${title}`);
	}

	return count.textContent ?? "";
}

async function flushEffects() {
	await act(async () => {
		await Promise.resolve();
		await Promise.resolve();
	});
}

describe("Customer display reconnect snapshot", () => {
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
	});

	it("refreshes order statuses from snapshot after reconnect when a websocket event was missed", async () => {
		const preparingOrder = buildOrder();
		const visibleReadyAt = new Date(Date.now() - 60_000).toISOString();
		const readyOrder = buildOrder({
			status: OrderStatus.READY,
			ready_at: visibleReadyAt,
			updated_at: visibleReadyAt,
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
		expect(useOrderStore.getState().orders.get(preparingOrder.id)?.status).toBe(
			OrderStatus.PREPARING,
		);
		expect(getColumnCount(container, "Hazırlanıyor")).toBe("1");
		expect(getColumnCount(container, "Hazır")).toBe("0");

		if (!socketOptions?.onConnect || !socketOptions.onDisconnect) {
			throw new Error("WebSocket callbacks were not captured");
		}

		await act(async () => {
			socketOptions.onConnect?.();
			socketOptions.onDisconnect?.();
			socketOptions.onConnect?.();
		});
		await flushEffects();

		expect(api.listOrders).toHaveBeenCalledTimes(2);
		expect(useOrderStore.getState().orders.get(preparingOrder.id)?.status).toBe(OrderStatus.READY);
		expect(getColumnCount(container, "Hazırlanıyor")).toBe("0");
		expect(getColumnCount(container, "Hazır")).toBe("1");
	});
});
