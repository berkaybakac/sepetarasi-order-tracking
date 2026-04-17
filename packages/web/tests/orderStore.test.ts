import { OrderStatus } from "@sepetarasi/shared";
import type { DayStats, Order } from "@sepetarasi/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/lib/api";
import { useOrderStore } from "../src/stores/orderStore";

// Mock the API calls
vi.mock("../src/lib/api", () => ({
	api: {
		listOrders: vi.fn(),
		getStats: vi.fn(),
	},
}));

function buildOrder(overrides: Partial<Order> = {}): Order {
	return {
		id: "o-1",
		business_date: "2026-04-13",
		display_no: 1,
		status: OrderStatus.PREPARING,
		terminal_id: null,
		customer_name: "Test Musteri",
		order_type: "Paket",
		target_minutes: null,
		notes: null,
		created_at: "2026-04-13T10:00:00.000Z",
		updated_at: "2026-04-13T10:00:00.000Z",
		ready_at: null,
		delivered_at: null,
		cancelled_at: null,
		items: [],
		...overrides,
	};
}

describe("Web orderStore", () => {
	beforeEach(() => {
		// Reset the store state before each test
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
		vi.clearAllMocks();
	});

	it("should initialize correctly", () => {
		const state = useOrderStore.getState();
		expect(state.connected).toBe(false);
		expect(state.hasConnectedOnce).toBe(false);
		expect(state.loading).toBe(false);
	});

	it("should set loading and isHydrating during hydration", async () => {
		vi.mocked(api.listOrders).mockResolvedValueOnce([]);
		vi.mocked(api.getStats).mockResolvedValueOnce({ totalOrders: 0 } as DayStats);

		const hydratePromise = useOrderStore.getState().hydrate();

		expect(useOrderStore.getState().loading).toBe(true);
		expect(useOrderStore.getState().isHydrating).toBe(true);

		await hydratePromise;

		expect(useOrderStore.getState().loading).toBe(false);
		expect(useOrderStore.getState().isHydrating).toBe(false);
		expect(useOrderStore.getState().lastSyncedAt).toBeGreaterThan(0);
	});

	it("should guard against concurrent hydration calls", async () => {
		vi.mocked(api.listOrders).mockResolvedValueOnce([]);
		vi.mocked(api.getStats).mockResolvedValueOnce({ totalOrders: 0 } as DayStats);

		const p1 = useOrderStore.getState().hydrate();
		const p2 = useOrderStore.getState().hydrate();

		await Promise.all([p1, p2]);

		// Should only have called the API once because p2 was guarded
		expect(api.listOrders).toHaveBeenCalledTimes(1);
	});

	it("should retry 3 times in silent mode before failing", async () => {
		vi.useFakeTimers();
		vi.mocked(api.listOrders).mockRejectedValue(new Error("Transient Error"));
		vi.mocked(api.getStats).mockResolvedValue({ totalOrders: 0 } as DayStats);

		const hydratePromise = useOrderStore.getState().hydrate(true);

		// Attempt 1 fails, wait for backoff
		await vi.advanceTimersByTimeAsync(2000);
		// Attempt 2 fails, wait for backoff
		await vi.advanceTimersByTimeAsync(4000);
		// Attempt 3 fails, wait for backoff
		await vi.advanceTimersByTimeAsync(8000);

		// Since attempt 4 (attempt > 3) will also fail, it should finally stop
		await hydratePromise;

		// 1 initial + 3 retries = 4 attempts total
		expect(api.listOrders).toHaveBeenCalledTimes(4);
		expect(useOrderStore.getState().isHydrating).toBe(false);
		vi.useRealTimers();
	});

	it("should hydrate orders even when stats request fails", async () => {
		const order = buildOrder();

		vi.mocked(api.listOrders).mockResolvedValueOnce([order]);
		vi.mocked(api.getStats).mockRejectedValueOnce(new Error("Unauthorized"));

		await useOrderStore.getState().hydrate();

		const state = useOrderStore.getState();
		expect(state.orders.get(order.id)?.display_no).toBe(1);
		expect(state.loading).toBe(false);
		expect(state.isHydrating).toBe(false);
	});

	it("should request stats in parallel with orders during hydration", async () => {
		let resolveOrders: ((orders: Order[]) => void) | null = null;

		vi.mocked(api.listOrders).mockImplementationOnce(
			() =>
				new Promise<Order[]>((resolve) => {
					resolveOrders = resolve;
				}),
		);
		vi.mocked(api.getStats).mockResolvedValueOnce({ totalOrders: 0 } as DayStats);

		const hydratePromise = useOrderStore.getState().hydrate();

		expect(api.listOrders).toHaveBeenCalledTimes(1);
		expect(api.getStats).toHaveBeenCalledTimes(1);

		resolveOrders?.([]);
		await hydratePromise;
	});

	it("should skip stats request when hydrate is called with includeStats=false", async () => {
		vi.mocked(api.listOrders).mockResolvedValueOnce([]);

		await useOrderStore.getState().hydrate(false, false);

		expect(api.listOrders).toHaveBeenCalledTimes(1);
		expect(api.getStats).not.toHaveBeenCalled();
	});

	it("should update lastReconnectedAt when reconnecting", () => {
		const hydrateSpy = vi.spyOn(useOrderStore.getState(), "hydrate").mockResolvedValue(true);

		// First connect
		useOrderStore.getState().setConnected(true);
		expect(useOrderStore.getState().hasConnectedOnce).toBe(true);
		expect(useOrderStore.getState().lastReconnectedAt).toBe(0);

		// Disconnect
		useOrderStore.getState().setConnected(false);

		// Reconnect
		useOrderStore.getState().setConnected(true);

		expect(useOrderStore.getState().lastReconnectedAt).toBeGreaterThan(0);
		expect(hydrateSpy).toHaveBeenCalledWith(true, true);
	});

	it("should allow reconnect hydration without stats", () => {
		const hydrateSpy = vi.spyOn(useOrderStore.getState(), "hydrate").mockResolvedValue(true);

		// First connect (no hydrate call)
		useOrderStore.getState().setConnected(true, { includeStatsOnReconnect: false });
		useOrderStore.getState().setConnected(false);

		// Reconnect with display-like config
		useOrderStore.getState().setConnected(true, { includeStatsOnReconnect: false });

		expect(hydrateSpy).toHaveBeenCalledWith(true, false);
	});

	it("does not replace order data when a silent hydration returns the same snapshot", async () => {
		const order = buildOrder();

		vi.mocked(api.listOrders).mockResolvedValueOnce([order]).mockResolvedValueOnce([buildOrder()]);

		await useOrderStore.getState().hydrate(false, false);

		const initialOrdersRef = useOrderStore.getState().orders;
		const initialSyncedAt = useOrderStore.getState().lastSyncedAt;

		await useOrderStore.getState().hydrate(true, false, { retryCount: 0 });

		expect(useOrderStore.getState().orders).toBe(initialOrdersRef);
		expect(useOrderStore.getState().lastSyncedAt).toBe(initialSyncedAt);
	});

	it("clears nowPlaying without mutating the current order snapshot", () => {
		const order = buildOrder();
		const orders = new Map<string, Order>([[order.id, order]]);
		useOrderStore.setState({
			orders,
			nowPlaying: { order_id: order.id, display_no: order.display_no },
		});

		useOrderStore.getState().clearNowPlaying();

		expect(useOrderStore.getState().nowPlaying).toBeNull();
		expect(useOrderStore.getState().orders).toBe(orders);
	});
});
