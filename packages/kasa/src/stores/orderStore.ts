import { type OrderStatus, applyOrderWsEvent } from "@sepetarasi/shared";
import type { Order, WsMessage } from "@sepetarasi/shared";
import { create } from "zustand";
import { ApiError, api } from "../lib/api";
import { reportRendererError, reportRendererWarning } from "../lib/electron";

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

				// Rate limit: retrying immediately makes things worse — bail out
				if (err instanceof ApiError && err.statusCode === 429) {
					reportRendererWarning({
						component: "order-store",
						event: "orders.hydrate_rate_limited",
						message: "Kasa order hydration was rate limited",
						error: err,
						context: { attempt, silent, statusCode: err.statusCode },
					});
					set({ error: errorMsg, isHydrating: false });
					if (!silent) set({ loading: false });
					return;
				}

				if (attempt <= retries) {
					const backoff = 1000 * 2 ** attempt;
					await delay(backoff);
				} else {
					reportRendererError({
						component: "order-store",
						event: "orders.hydrate_failed",
						message: "Kasa order hydration failed after retries",
						error: err,
						context: { attempt, silent },
					});
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
			} else {
				// First time connection established
				set({ hasConnectedOnce: true });
			}

			// Pull the current snapshot whenever the socket comes up so transient startup
			// failures do not leave the cashier screen in a stale state.
			void get().hydrate(true);
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
