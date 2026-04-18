const RATE_LIMIT_TIME_WINDOW = "1 minute" as const;
const LAN_RATE_LIMIT_MAX = 1200;
const AUTH_RATE_LIMIT_MAX = 500;

export const GENERIC_API_RATE_LIMIT_MAX = LAN_RATE_LIMIT_MAX;

export const AUTH_RATE_LIMIT = {
	max: AUTH_RATE_LIMIT_MAX,
	timeWindow: RATE_LIMIT_TIME_WINDOW,
} as const;

export const DELIVERY_ANALYTICS_RATE_LIMIT = {
	max: LAN_RATE_LIMIT_MAX,
	timeWindow: RATE_LIMIT_TIME_WINDOW,
} as const;

export const MUSIC_UPLOAD_RATE_LIMIT = {
	max: LAN_RATE_LIMIT_MAX,
	timeWindow: RATE_LIMIT_TIME_WINDOW,
} as const;
