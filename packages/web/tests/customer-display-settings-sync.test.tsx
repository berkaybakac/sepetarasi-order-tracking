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
		business_date: "2026-04-18",
		display_no: 18,
		status: OrderStatus.PREPARING,
		terminal_id: "KASA-1",
		customer_name: "Display Musteri",
		order_type: "Paket",
		target_minutes: null,
		notes: null,
		created_at: "2026-04-18T12:00:00.000Z",
		updated_at: "2026-04-18T12:00:00.000Z",
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

function getButton(container: HTMLDivElement, label: string) {
	const button = Array.from(container.querySelectorAll("button")).find((node) =>
		node.textContent?.includes(label),
	);

	if (!(button instanceof HTMLButtonElement)) {
		throw new Error(`Button not found: ${label}`);
	}

	return button;
}

describe("CustomerDisplay settings sync", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

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

		vi.mocked(useWebSocket).mockImplementation(() => ({ current: null }) as never);
		vi.mocked(api.listOrders).mockResolvedValue([buildOrder()]);
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

	it("keeps the display usable without a visible warning when settings sync fails", async () => {
		vi.mocked(api.getPublicSettings).mockRejectedValueOnce(new Error("settings offline"));

		await act(async () => {
			root.render(
				<MemoryRouter initialEntries={["/display"]}>
					<CustomerDisplay />
				</MemoryRouter>,
			);
		});
		await flushEffects();

		expect(api.getPublicSettings).toHaveBeenCalledTimes(1);
		expect(container.textContent).toContain("Hazırlanıyor");
		expect(container.textContent).not.toContain(
			"Ekran ayarları alınamadı. Son bilinen görünüm kullanılıyor.",
		);
		expect(container.textContent).not.toContain("Tekrar Dene");
	});
});
