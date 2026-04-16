/** @vitest-environment jsdom */

import { type Order, OrderStatus } from "@sepetarasi/shared";
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderList } from "../src/components/OrderList";
import { useOrderStore } from "../src/stores/orderStore";

function buildOrder(overrides: Partial<Order> = {}): Order {
	return {
		id: "order-1",
		business_date: "2026-04-16",
		display_no: 1,
		status: OrderStatus.PREPARING,
		terminal_id: "KASA-1",
		customer_name: "Ayse",
		order_type: "Paket",
		target_minutes: null,
		notes: null,
		created_at: "2026-04-16T10:00:00.000Z",
		updated_at: "2026-04-16T10:00:00.000Z",
		ready_at: null,
		delivered_at: null,
		cancelled_at: null,
		items: [],
		...overrides,
	};
}

describe("Kasa OrderList empty state", () => {
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
	});

	afterEach(async () => {
		await act(async () => {
			root.unmount();
		});
		container.remove();
		vi.restoreAllMocks();
	});

	it("keeps the empty state calm even when the last hydration failed", async () => {
		useOrderStore.setState({ error: "Sunucuya ulasilamiyor", orders: new Map() });

		await act(async () => {
			root.render(<OrderList />);
		});

		expect(container.textContent).toContain("Aktif sipariş yok");
		expect(container.textContent).not.toContain("Siparişler alınamadı");
		expect(container.textContent).not.toContain("Tekrar dene");
	});

	it("shows empty state when there is no error", async () => {
		useOrderStore.setState({ error: null, orders: new Map() });

		await act(async () => {
			root.render(<OrderList />);
		});

		expect(container.textContent).toContain("Aktif sipariş yok");
		expect(container.textContent).not.toContain("Siparişler alınamadı");
	});

	it("keeps showing existing orders even when store has an error message", async () => {
		const orders = new Map<string, Order>();
		orders.set("order-1", buildOrder({ customer_name: "Mehmet", status: OrderStatus.PREPARING }));
		useOrderStore.setState({ error: "Arka plan hydrate hatasi", orders });

		await act(async () => {
			root.render(<OrderList />);
		});

		expect(container.textContent).toContain("Mehmet");
		expect(container.textContent).not.toContain("Siparişler alınamadı");
		expect(container.textContent).not.toContain("Aktif sipariş yok");
	});
});
