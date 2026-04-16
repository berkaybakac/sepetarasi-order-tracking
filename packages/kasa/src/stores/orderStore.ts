import { type OrderStatus, applyOrderWsEvent } from "@sepetarasi/shared";
import type { Order, WsMessage } from "@sepetarasi/shared";
import { create } from "zustand";
import { ApiError, api } from "../lib/api";

interface OrderState {
	orders: Map<string, Order>;
	connected: boolean;
	loading: boolean;
	error: string | null;
	hasConnectedOnce: boolean;
	isHydrating: boolean;
	lastReconnectedAt: number;

	// Actions
	hydrate: (silent?: boolean) => Promise<void>;
	applyWsEvent: (msg: WsMessage) => void;
	setConnected: (connected: boolean) => void;
}

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const useOrderStore = create<OrderState>((set, get) => ({
	orders: new Map(),
	connected: false,
	loading: false,
	error: null,
	hasConnectedOnce: false,
	isHydrating: false,
	lastReconnectedAt: 0,

	hydrate: async (silent = false) => {
		if (get().isHydrating) return;
		set({ isHydrating: true });

		if (!silent) set({ loading: true, error: null });

		const retries = silent ? 3 : 0;
		let attempt = 0;

		while (attempt <= retries) {
			try {
				const orderList = await api.listOrders();
				const orders = new Map<string, Order>();
				for (const order of orderList) {
					orders.set(order.id, order);
				}
				set({ orders, loading: false, isHydrating: false, error: null });
				return;
			} catch (err) {
				attempt++;
				const errorMsg = (err as Error).message;
				console.error(`Failed to hydrate orders (attempt ${attempt}):`, errorMsg);

				// Rate limit: retrying immediately makes things worse — bail out
				if (err instanceof ApiError && err.statusCode === 429) {
					set({ error: errorMsg, isHydrating: false });
					if (!silent) set({ loading: false });
					return;
				}

				if (attempt <= retries) {
					const backoff = 1000 * 2 ** attempt;
					await delay(backoff);
				} else {
					set({ error: errorMsg });
					if (!silent) set({ loading: false });
					set({ isHydrating: false });
				}
			}
		}
	},

	applyWsEvent: (msg: WsMessage) => {
		const { orders } = get();
		const update = applyOrderWsEvent(orders, msg);
		if (update) {
			set(update);
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
