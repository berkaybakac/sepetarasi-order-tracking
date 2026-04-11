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
	getBaseUrl: vi.fn(() => "http://localhost:3000"),
}));

describe("Kasa orderStore", () => {
	beforeEach(() => {
		// Reset the store state before each test
		useOrderStore.setState({
			orders: new Map(),
			stats: null,
			connected: false,
			loading: false,
			error: null,
			hasConnectedOnce: false,
			isHydrating: false,
			lastReconnectedAt: 0,
		});
		vi.clearAllMocks();
	});

	it("should initialize correctly", () => {
		const state = useOrderStore.getState();
		expect(state.connected).toBe(false);
		expect(state.hasConnectedOnce).toBe(false);
		expect(state.loading).toBe(false);
		expect(state.error).toBe(null);
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

	it("should update lastReconnectedAt when reconnecting", () => {
		const hydrateSpy = vi.spyOn(useOrderStore.getState(), "hydrate").mockResolvedValue(undefined);

		// First connect
		useOrderStore.getState().setConnected(true);
		expect(useOrderStore.getState().hasConnectedOnce).toBe(true);
		expect(useOrderStore.getState().lastReconnectedAt).toBe(0);

		// Disconnect
		useOrderStore.getState().setConnected(false);

		// Reconnect
		useOrderStore.getState().setConnected(true);

		expect(useOrderStore.getState().lastReconnectedAt).toBeGreaterThan(0);
		expect(hydrateSpy).toHaveBeenCalledWith(true);
	});
});
