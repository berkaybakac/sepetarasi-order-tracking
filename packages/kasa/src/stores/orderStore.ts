import { type OrderStatus, WS_EVENTS } from "@sepetarasi/shared";
import type { DayStats, Order, OrderStatusChangedPayload, WsMessage } from "@sepetarasi/shared";
import { create } from "zustand";
import { api } from "../lib/api";

interface OrderState {
	orders: Map<string, Order>;
	stats: DayStats | null;
	connected: boolean;
	loading: boolean;
	error: string | null;

	// Actions
	hydrate: () => Promise<void>;
	applyWsEvent: (msg: WsMessage) => void;
	setConnected: (connected: boolean) => void;
}

export const useOrderStore = create<OrderState>((set, get) => ({
	orders: new Map(),
	stats: null,
	connected: false,
	loading: false,
	error: null,

	hydrate: async () => {
		set({ loading: true, error: null });
		try {
			const [orderList, stats] = await Promise.all([api.listOrders(), api.getStats()]);
			const orders = new Map<string, Order>();
			for (const order of orderList) {
				orders.set(order.id, order);
			}
			set({ orders, stats, loading: false });
		} catch (err) {
			set({ error: (err as Error).message, loading: false });
		}
	},

	applyWsEvent: (msg: WsMessage) => {
		const { orders } = get();

		switch (msg.event) {
			case WS_EVENTS.ORDER_CREATED: {
				const order = msg.data as Order;
				const next = new Map(orders);
				next.set(order.id, order);
				set({ orders: next });
				break;
			}
			case WS_EVENTS.ORDER_STATUS_CHANGED: {
				const payload = msg.data as OrderStatusChangedPayload;
				const existing = orders.get(payload.id);
				if (existing) {
					const next = new Map(orders);
					next.set(payload.id, {
						...existing,
						status: payload.status,
						ready_at: payload.ready_at ?? existing.ready_at,
						delivered_at: payload.delivered_at ?? existing.delivered_at,
						cancelled_at: payload.cancelled_at ?? existing.cancelled_at,
					});
					set({ orders: next });
				}
				break;
			}
			case WS_EVENTS.STATS_UPDATED: {
				set({ stats: msg.data as DayStats });
				break;
			}
		}
	},

	setConnected: (connected: boolean) => set({ connected }),
}));

/** Helper: get orders as sorted array (by display_no desc) */
export function useOrderList() {
	const orders = useOrderStore((s) => s.orders);
	return Array.from(orders.values()).sort((a, b) => b.display_no - a.display_no);
}

/** Helper: get orders filtered by status */
export function useOrdersByStatus(status: OrderStatus) {
	const orders = useOrderStore((s) => s.orders);
	return Array.from(orders.values())
		.filter((o) => o.status === status)
		.sort((a, b) => a.display_no - b.display_no);
}
