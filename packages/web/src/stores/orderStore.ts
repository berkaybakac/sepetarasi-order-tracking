import { type OrderStatus, applyAnnouncementWsEvent, applyOrderWsEvent } from "@sepetarasi/shared";
import type { AnnouncementPayload, DayStats, Order, WsMessage } from "@sepetarasi/shared";
import { create } from "zustand";
import { api } from "../lib/api";

interface OrderState {
	orders: Map<string, Order>;
	stats: DayStats | null;
	connected: boolean;
	loading: boolean;
	nowPlaying: AnnouncementPayload | null;
	hasConnectedOnce: boolean;
	isHydrating: boolean;
	lastReconnectedAt: number;

	hydrate: (silent?: boolean) => Promise<void>;
	applyWsEvent: (msg: WsMessage) => void;
	setConnected: (connected: boolean) => void;
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
	nowPlaying: null,

	hydrate: async (silent = false) => {
		if (get().isHydrating) return;
		set({ isHydrating: true });

		if (!silent) set({ loading: true });

		const retries = silent ? 3 : 0;
		let attempt = 0;

		while (attempt <= retries) {
			try {
				const [orderList, stats] = await Promise.all([api.listOrders(), api.getStats()]);
				const orders = new Map<string, Order>();
				for (const order of orderList) {
					orders.set(order.id, order);
				}
				set({ orders, stats, loading: false, isHydrating: false });
				return;
			} catch (err) {
				attempt++;
				console.error(`Failed to hydrate orders (attempt ${attempt}):`, err);

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
			set(orderUpdate);
			return;
		}

		const announcementUpdate = applyAnnouncementWsEvent(msg);
		if (announcementUpdate) {
			set(announcementUpdate);
		}
	},

	setConnected: (connected: boolean) => {
		const state = get();
		if (state.connected === connected) return;

		set({ connected });

		if (connected) {
			if (state.hasConnectedOnce) {
				// Re-connected after being disconnected!
				set({ lastReconnectedAt: Date.now() });
				// Silently re-hydrate the state with latest events
				get().hydrate(true);
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
