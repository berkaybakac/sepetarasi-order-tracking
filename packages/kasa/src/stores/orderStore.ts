import { type OrderStatus, applyOrderWsEvent } from "@sepetarasi/shared";
import type { DayStats, Order, WsMessage } from "@sepetarasi/shared";
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
		const update = applyOrderWsEvent(orders, msg);
		if (update) {
			set(update);
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
