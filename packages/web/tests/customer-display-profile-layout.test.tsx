/** @vitest-environment jsdom */

import { type Order, OrderStatus } from "@sepetarasi/shared";
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWebSocket } from "../src/hooks/useWebSocket";
import { api } from "../src/lib/api";
import { useOrderStore } from "../src/stores/orderStore";
import { CustomerDisplay } from "../src/views/display/CustomerDisplay";

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
		id: `display-order-${overrides.display_no ?? 1}`,
		business_date: "2026-04-20",
		display_no: 1,
		status: OrderStatus.PREPARING,
		terminal_id: "KASA-1",
		customer_name: "Display Musteri",
		order_type: "Paket",
		target_minutes: null,
		notes: null,
		created_at: "2026-04-20T09:00:00.000Z",
		updated_at: "2026-04-20T09:00:00.000Z",
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

describe("CustomerDisplay profile-specific layout", () => {
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
			nowPlaying: { order_id: "display-order-91", display_no: 91 },
		});

		vi.mocked(useWebSocket).mockReturnValue({ current: null });
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

	it("uses compact split layout for tiny landscape profile and hides the page indicator", async () => {
		vi.mocked(api.listOrders).mockResolvedValue([
			buildOrder({ id: "display-order-11", display_no: 11, status: OrderStatus.PREPARING }),
			buildOrder({ id: "display-order-12", display_no: 12, status: OrderStatus.PREPARING }),
			buildOrder({ id: "display-order-13", display_no: 13, status: OrderStatus.PREPARING }),
			buildOrder({
				id: "display-order-91",
				display_no: 91,
				status: OrderStatus.READY,
				ready_at: "2026-04-20T09:02:00.000Z",
				updated_at: "2026-04-20T09:02:00.000Z",
			}),
			buildOrder({
				id: "display-order-92",
				display_no: 92,
				status: OrderStatus.READY,
				ready_at: "2026-04-20T09:03:00.000Z",
				updated_at: "2026-04-20T09:03:00.000Z",
			}),
			buildOrder({
				id: "display-order-93",
				display_no: 93,
				status: OrderStatus.READY,
				ready_at: "2026-04-20T09:04:00.000Z",
				updated_at: "2026-04-20T09:04:00.000Z",
			}),
		]);

		await act(async () => {
			root.render(
				<MemoryRouter initialEntries={["/display?profile=tiny_landscape"]}>
					<CustomerDisplay />
				</MemoryRouter>,
			);
		});
		await flushEffects();

		const rootElement = container.firstElementChild;
		expect(rootElement?.getAttribute("data-display-profile")).toBe("tiny_landscape");
		expect(rootElement?.getAttribute("data-display-layout")).toBe("split");
		expect(rootElement?.getAttribute("data-display-density")).toBe("compact");
		expect(container.querySelector('[data-display-main-grid="split"]')).not.toBeNull();
		expect(container.querySelector('[data-display-header="compact"]')).not.toBeNull();
		expect(container.querySelector('[data-display-now-serving-mode="compact"]')).not.toBeNull();
		expect(container.querySelector("[data-display-page-indicator]")).toBeNull();
		expect(container.textContent).toContain("Hazırlanıyor");
		expect(container.textContent).toContain("Hazır");
		expect(container.textContent).toContain("#91");
	});
});
