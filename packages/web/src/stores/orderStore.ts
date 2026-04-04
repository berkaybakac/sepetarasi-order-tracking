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

	hydrate: () => Promise<void>;
	applyWsEvent: (msg: WsMessage) => void;
	setConnected: (connected: boolean) => void;
}

export const useOrderStore = create<OrderState>((set, get) => ({
	orders: new Map(),
	stats: null,
	connected: false,
	loading: false,
	nowPlaying: null,

	hydrate: async () => {
		set({ loading: true });
		try {
			const [orderList, stats] = await Promise.all([api.listOrders(), api.getStats()]);
			const orders = new Map<string, Order>();
			for (const order of orderList) {
				orders.set(order.id, order);
			}
			set({ orders, stats, loading: false });
		} catch (err) {
			console.error("Failed to hydrate orders:", err);
			set({ loading: false });
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

	setConnected: (connected: boolean) => set({ connected }),
}));

export function useOrdersByStatus(status: OrderStatus) {
	const orders = useOrderStore((s) => s.orders);
	return Array.from(orders.values())
		.filter((o) => o.status === status)
		.sort((a, b) => a.display_no - b.display_no);
}
