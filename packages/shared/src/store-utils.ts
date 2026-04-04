import { WS_EVENTS } from "./constants.js";
import type {
	AnnouncementPayload,
	DayStats,
	Order,
	OrderStatusChangedPayload,
	WsMessage,
} from "./types.js";

/**
 * Pure reducer for order/stats WS events.
 * Returns a partial state update or null if the event is not handled here.
 * Used by both web and kasa orderStore.
 */
export function applyOrderWsEvent(
	orders: Map<string, Order>,
	msg: WsMessage,
): Partial<{ orders: Map<string, Order>; stats: DayStats | null }> | null {
	switch (msg.event) {
		case WS_EVENTS.ORDER_CREATED: {
			const order = msg.data as Order;
			const next = new Map(orders);
			next.set(order.id, order);
			return { orders: next };
		}
		case WS_EVENTS.ORDER_STATUS_CHANGED: {
			const payload = msg.data as OrderStatusChangedPayload;
			const existing = orders.get(payload.id);
			if (!existing) return null;
			const next = new Map(orders);
			next.set(payload.id, {
				...existing,
				status: payload.status,
				ready_at: payload.ready_at ?? existing.ready_at,
				delivered_at: payload.delivered_at ?? existing.delivered_at,
				cancelled_at: payload.cancelled_at ?? existing.cancelled_at,
			});
			return { orders: next };
		}
		case WS_EVENTS.STATS_UPDATED: {
			return { stats: msg.data as DayStats };
		}
		default:
			return null;
	}
}

/**
 * Pure reducer for announcement WS events.
 * Returns a partial state update or null if the event is not handled here.
 * Used only by web orderStore (kasa does not subscribe to announcement events).
 */
export function applyAnnouncementWsEvent(
	msg: WsMessage,
): { nowPlaying: AnnouncementPayload | null } | null {
	switch (msg.event) {
		case WS_EVENTS.ANNOUNCEMENT_NOW_PLAYING:
			return { nowPlaying: msg.data as AnnouncementPayload };
		case WS_EVENTS.ANNOUNCEMENT_FINISHED:
			return { nowPlaying: null };
		default:
			return null;
	}
}
