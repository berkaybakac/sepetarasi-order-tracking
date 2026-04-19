import { OrderStatus, applyAnnouncementWsEvent, applyOrderWsEvent } from "@sepetarasi/shared";
import type { AnnouncementPayload, DayStats, Order, WsMessage } from "@sepetarasi/shared";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { api } from "../lib/api";
import { logger } from "../lib/logger";

interface OrderState {
	orders: Map<string, Order>;
	stats: DayStats | null;
	connected: boolean;
	loading: boolean;
	initialLoadSettled: boolean;
	nowPlaying: AnnouncementPayload | null;
	hasConnectedOnce: boolean;
	isHydrating: boolean;
	lastReconnectedAt: number;
	lastSyncedAt: number;

	hydrate: (
		silent?: boolean,
		includeStats?: boolean,
		options?: { retryCount?: number },
	) => Promise<boolean>;
	applyWsEvent: (msg: WsMessage) => void;
	setConnected: (connected: boolean, options?: { includeStatsOnReconnect?: boolean }) => void;
	clearNowPlaying: () => void;
}

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

function areOrderItemsEqual(a: Order["items"], b: Order["items"]) {
	if (a === b) return true;
	const left = a ?? [];
	const right = b ?? [];
	if (left.length !== right.length) return false;

	for (let index = 0; index < left.length; index += 1) {
		const leftItem = left[index];
		const rightItem = right[index];
		if (!rightItem) return false;
		if (
			leftItem.id !== rightItem.id ||
			leftItem.order_id !== rightItem.order_id ||
			leftItem.name !== rightItem.name ||
			leftItem.quantity !== rightItem.quantity ||
			leftItem.unit_price !== rightItem.unit_price ||
			leftItem.notes !== rightItem.notes
		) {
			return false;
		}
	}

	return true;
}

function areOrdersEqual(a: Order, b: Order) {
	return (
		a.id === b.id &&
		a.business_date === b.business_date &&
		a.display_no === b.display_no &&
		a.status === b.status &&
		a.terminal_id === b.terminal_id &&
		a.customer_name === b.customer_name &&
		a.order_type === b.order_type &&
		a.target_minutes === b.target_minutes &&
		a.notes === b.notes &&
		a.created_at === b.created_at &&
		a.updated_at === b.updated_at &&
		a.ready_at === b.ready_at &&
		a.delivered_at === b.delivered_at &&
		a.cancelled_at === b.cancelled_at &&
		areOrderItemsEqual(a.items, b.items)
	);
}

function areOrderMapsEqual(a: Map<string, Order>, b: Map<string, Order>) {
	if (a === b) return true;
	if (a.size !== b.size) return false;

	for (const [id, order] of a) {
		const nextOrder = b.get(id);
		if (!nextOrder || !areOrdersEqual(order, nextOrder)) {
			return false;
		}
	}

	return true;
}

function areStatsEqual(a: DayStats | null, b: DayStats | null) {
	if (a === b) return true;
	if (!a || !b) return false;

	return (
		a.totalOrders === b.totalOrders &&
		a.averagePrepMinutes === b.averagePrepMinutes &&
		a.averageDeliverySeconds === b.averageDeliverySeconds &&
		a.byStatus.PREPARING === b.byStatus.PREPARING &&
		a.byStatus.READY === b.byStatus.READY &&
		a.byStatus.DELIVERED === b.byStatus.DELIVERED &&
		a.byStatus.CANCELLED === b.byStatus.CANCELLED
	);
}

export const useOrderStore = create<OrderState>((set, get) => ({
	orders: new Map(),
	stats: null,
	connected: false,
	loading: false,
	initialLoadSettled: false,
	hasConnectedOnce: false,
	isHydrating: false,
	lastReconnectedAt: 0,
	lastSyncedAt: 0,
	nowPlaying: null,

	hydrate: async (silent = false, includeStats = true, options = undefined) => {
		if (get().isHydrating) return false;
		set({ isHydrating: true });

		if (!silent) set({ loading: true });

		const retries = options?.retryCount ?? (silent ? 3 : 0);
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

				const nextOrders = new Map<string, Order>();
				for (const order of orderList) {
					nextOrders.set(order.id, order);
				}
				const state = get();
				const ordersChanged = !areOrderMapsEqual(state.orders, nextOrders);
				const statsChanged = includeStats ? !areStatsEqual(state.stats, stats) : false;
				const nextState: Partial<OrderState> = {
					loading: false,
					initialLoadSettled: true,
					isHydrating: false,
				};

				if (ordersChanged) {
					nextState.orders = nextOrders;
				}

				if (includeStats && statsChanged) {
					nextState.stats = stats;
				}

				if (ordersChanged || statsChanged) {
					nextState.lastSyncedAt = Date.now();
				}

				set(nextState);
				return true;
			} catch (err) {
				attempt++;
				logger.error("orderStore", `Failed to hydrate orders (attempt ${attempt}).`, err);

				if (attempt <= retries) {
					const backoff = 1000 * 2 ** attempt; // 2s, 4s, 8s
					await delay(backoff);
				} else {
					if (!silent) set({ loading: false });
					set({ initialLoadSettled: true, isHydrating: false });
					return false;
				}
			}
		}

		return false;
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

	clearNowPlaying: () => {
		if (!get().nowPlaying) return;
		set({ nowPlaying: null });
	},
}));

export function useOrdersByStatus(status: OrderStatus) {
	return useOrderStore(
		useShallow((s) => {
			const filtered = Array.from(s.orders.values()).filter((o) => o.status === status);
			// DELIVERED: en yeni önce; diğerleri: en eski önce (önce gelen önce teslim edilmeli)
			return status === OrderStatus.DELIVERED
				? filtered.sort((a, b) => b.display_no - a.display_no)
				: filtered.sort((a, b) => a.display_no - b.display_no);
		}),
	);
}
