export enum OrderStatus {
	PREPARING = "PREPARING",
	READY = "READY",
	DELIVERED = "DELIVERED",
	CANCELLED = "CANCELLED",
}

export enum AnnouncementStatus {
	PENDING = "pending",
	PLAYING = "playing",
	PLAYED = "played",
	FAILED = "failed",
}

export enum AnnouncementType {
	READY = "ready",
}

export enum TerminalType {
	KASA = "kasa",
	DASHBOARD = "dashboard",
	DISPLAY = "display",
}

/** Valid status transitions: key = from, value = allowed targets */
export const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
	[OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
	[OrderStatus.READY]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.PREPARING],
	[OrderStatus.DELIVERED]: [],
	[OrderStatus.CANCELLED]: [],
};

export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
	return STATUS_TRANSITIONS[from].includes(to);
}

/** WebSocket event names */
export const WS_EVENTS = {
	ORDER_CREATED: "order:created",
	ORDER_STATUS_CHANGED: "order:status_changed",
	STATS_UPDATED: "stats:updated",
	ANNOUNCEMENT_NOW_PLAYING: "announcement:now_playing",
	ANNOUNCEMENT_FINISHED: "announcement:finished",
} as const;

/** WebSocket channel names */
export const WS_CHANNELS = {
	ORDERS: "orders",
	DISPLAY: "display",
} as const;
