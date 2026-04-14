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

export const ORDER_TYPES = ["Paket", "Masada"] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export function isOrderType(value: string): value is OrderType {
	return ORDER_TYPES.includes(value as OrderType);
}

export const DISPLAY_PROFILES = ["auto", "led_256x512", "tv_1080p"] as const;
export type DisplayProfile = (typeof DISPLAY_PROFILES)[number];

export const DISPLAY_LAYOUT_PREFERENCES = ["auto", "split", "stack"] as const;
export type DisplayLayoutPreference = (typeof DISPLAY_LAYOUT_PREFERENCES)[number];

export const DISPLAY_TEXT_SCALES = ["s", "m", "l"] as const;
export type DisplayTextScale = (typeof DISPLAY_TEXT_SCALES)[number];

export const DISPLAY_THEMES = ["dark", "light", "vivid", "retro"] as const;
export type DisplayTheme = (typeof DISPLAY_THEMES)[number];

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
	MUSIC_STATUS_CHANGED: "music:status_changed",
} as const;

/** WebSocket channel names */
export const WS_CHANNELS = {
	ORDERS: "orders",
	DISPLAY: "display",
} as const;

/** Sistem Ayarları Anahtarları (Magic Strings SSoT) */
export const SETTING_KEYS = {
	AUDIO_VOLUME: "audio_volume",
	ADMIN_PASSWORD_HASH: "admin_password_hash",
	RESTAURANT_NAME: "restaurant_name",
	DISPLAY_PROFILE: "display_profile",
	DISPLAY_LAYOUT: "display_layout",
	DISPLAY_MAX_VISIBLE: "display_max_visible",
	DISPLAY_PAGE_SECONDS: "display_page_seconds",
	DISPLAY_READY_MINUTES: "display_ready_minutes",
	DISPLAY_TEXT_SCALE: "display_text_scale",
	DISPLAY_THEME: "display_theme",
	MUSIC_VOLUME: "music_volume",
	MUSIC_ENABLED: "music_enabled",
	MUSIC_CURRENT_TRACK_ID: "music_current_track_id",
} as const;

/** İstatistik Periyotları Seçenekleri (SSoT) */
export const STAT_PERIODS = ["daily", "weekly", "monthly"] as const;
export type StatPeriod = (typeof STAT_PERIODS)[number];

/** API Endpoint Yolları (SSoT) */
export const API_ROUTES = {
	V1: {
		ORDERS: "/api/v1/orders",
		ORDER_BY_ID: "/api/v1/orders/:id",
		ORDER_STATUS: (id: string | number) => `/api/v1/orders/${id}/status`,
		STATS_TODAY: "/api/v1/stats/today",
		STATS: "/api/v1/stats",
		SETTINGS: "/api/v1/settings",
		SETTINGS_BULK: "/api/v1/settings/bulk",
		SETTINGS_PUBLIC: "/api/v1/settings/public",
		SETTING_BY_KEY: (key: string) => `/api/v1/settings/${key}`,
		AUTH: {
			LOGIN: "/api/v1/auth/login",
			LOGOUT: "/api/v1/auth/logout",
			ME: "/api/v1/auth/me",
			CHANGE_PASSWORD: "/api/v1/auth/change-password",
		},
	},
} as const;
