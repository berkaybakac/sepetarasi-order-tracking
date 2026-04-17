import { type OrderStatus, applyAnnouncementWsEvent, applyOrderWsEvent } from "@sepetarasi/shared";
import type { AnnouncementPayload, DayStats, Order, WsMessage } from "@sepetarasi/shared";
import { create } from "zustand";
import { api } from "../lib/api";
import { logger } from "../lib/logger";

interface OrderState {
	orders: Map<string, Order>;
	stats: DayStats | null;
	connected: boolean;
	loading: boolean;
	nowPlaying: AnnouncementPayload | null;
	hasConnectedOnce: boolean;
	isHydrating: boolean;
	lastReconnectedAt: number;
	lastSyncedAt: number;

	hydrate: (silent?: boolean, includeStats?: boolean) => Promise<void>;
	applyWsEvent: (msg: WsMessage) => void;
	setConnected: (connected: boolean, options?: { includeStatsOnReconnect?: boolean }) => void;
}

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const useOrderStore = create<OrderState>((set, get) => ({
	orders: new Map(),
	stats: null,
	connected: false,
	loading: false,
	hasConnectedOnce: false,
	isHydrating: false,
	lastReconnectedAt: 0,
	lastSyncedAt: 0,
	nowPlaying: null,

	hydrate: async (silent = false, includeStats = true) => {
		if (get().isHydrating) return;
		set({ isHydrating: true });

		if (!silent) set({ loading: true });

		const retries = silent ? 3 : 0;
		let attempt = 0;

		while (attempt <= retries) {
			try {
				const statsPromise = includeStats
					? api.getStats().catch((statsErr) => {
							// Do not fail order hydration when stats endpoint is unauthorized/unavailable
							// (e.g. public customer display route).
							logger.warn(
								"orderStore",
								"Failed to hydrate stats; continuing with orders only.",
								statsErr,
							);
							return get().stats;
						})
					: Promise.resolve(get().stats);
				const [orderList, stats] = await Promise.all([api.listOrders(), statsPromise]);

				const orders = new Map<string, Order>();
				for (const order of orderList) {
					orders.set(order.id, order);
				}
				set({
					orders,
					stats,
					loading: false,
					isHydrating: false,
					lastSyncedAt: Date.now(),
				});
				return;
			} catch (err) {
				attempt++;
				logger.error("orderStore", `Failed to hydrate orders (attempt ${attempt}).`, err);

				if (attempt <= retries) {
					const backoff = 1000 * 2 ** attempt; // 2s, 4s, 8s
					await delay(backoff);
				} else {
					if (!silent) set({ loading: false });
					set({ isHydrating: false });
				}
			}
		}
	},

	applyWsEvent: (msg: WsMessage) => {
		const { orders } = get();

		const orderUpdate = applyOrderWsEvent(orders, msg);
		if (orderUpdate) {
			set({ ...orderUpdate, lastSyncedAt: Date.now() });
			return;
		}

		const announcementUpdate = applyAnnouncementWsEvent(msg);
		if (announcementUpdate) {
			set({ ...announcementUpdate, lastSyncedAt: Date.now() });
		}
	},

	setConnected: (connected: boolean, options?: { includeStatsOnReconnect?: boolean }) => {
		const state = get();
		if (state.connected === connected) return;

		set({ connected });

		if (connected) {
			if (state.hasConnectedOnce) {
				// Re-connected after being disconnected!
				set({ lastReconnectedAt: Date.now() });
				// Silently re-hydrate the state with latest events
				get().hydrate(true, options?.includeStatsOnReconnect ?? true);
			} else {
				// First time connection established
				set({ hasConnectedOnce: true });
			}
		}
	},
}));

export function useOrdersByStatus(status: OrderStatus) {
	const orders = useOrderStore((s) => s.orders);
	return Array.from(orders.values())
		.filter((o) => o.status === status)
		.sort((a, b) => a.display_no - b.display_no);
}
