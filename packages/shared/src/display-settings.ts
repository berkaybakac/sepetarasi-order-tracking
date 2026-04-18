import {
	DISPLAY_LAYOUT_PREFERENCES,
	DISPLAY_PROFILES,
	DISPLAY_TEXT_SCALES,
	DISPLAY_THEMES,
	type DisplayLayoutPreference,
	type DisplayProfile,
	type DisplayTextScale,
	type DisplayTheme,
	SETTING_KEYS,
} from "./constants.js";

export interface DisplayConfig {
	profile: DisplayProfile;
	layoutPreference: DisplayLayoutPreference;
	maxVisiblePerColumn: number;
	pageSeconds: number;
	restaurantName: string;
	readyDisplayMinutes: number;
	textScale: DisplayTextScale;
	theme: DisplayTheme;
}

export const DISPLAY_SETTING_KEYS = [
	SETTING_KEYS.RESTAURANT_NAME,
	SETTING_KEYS.DISPLAY_PROFILE,
	SETTING_KEYS.DISPLAY_LAYOUT,
	SETTING_KEYS.DISPLAY_MAX_VISIBLE,
	SETTING_KEYS.DISPLAY_PAGE_SECONDS,
	SETTING_KEYS.DISPLAY_READY_MINUTES,
	SETTING_KEYS.DISPLAY_TEXT_SCALE,
	SETTING_KEYS.DISPLAY_THEME,
] as const;

export type DisplaySettingKey = (typeof DISPLAY_SETTING_KEYS)[number];

export const DISPLAY_PUBLIC_SETTING_KEYS = [...DISPLAY_SETTING_KEYS] as const;
export const DISPLAY_EDITABLE_SETTING_KEYS = [...DISPLAY_SETTING_KEYS] as const;

const DISPLAY_SETTING_KEY_SET = new Set<string>(DISPLAY_SETTING_KEYS);
const DISPLAY_PROFILE_SET = new Set<DisplayProfile>(DISPLAY_PROFILES);
const DISPLAY_LAYOUT_SET = new Set<DisplayLayoutPreference>(DISPLAY_LAYOUT_PREFERENCES);
const DISPLAY_TEXT_SCALE_SET = new Set<DisplayTextScale>(DISPLAY_TEXT_SCALES);
const DISPLAY_THEME_SET = new Set<DisplayTheme>(DISPLAY_THEMES);

const PROFILE_DEFAULTS: Record<
	DisplayProfile,
	Omit<DisplayConfig, "profile" | "restaurantName" | "readyDisplayMinutes" | "textScale" | "theme">
> = {
	auto: { layoutPreference: "auto", maxVisiblePerColumn: 20, pageSeconds: 8 },
	led_256x512: { layoutPreference: "stack", maxVisiblePerColumn: 4, pageSeconds: 6 },
	tv_1080p: { layoutPreference: "split", maxVisiblePerColumn: 24, pageSeconds: 8 },
};

export const DEFAULT_DISPLAY_CONFIG: DisplayConfig = {
	profile: "auto",
	...PROFILE_DEFAULTS.auto,
	restaurantName: "SEPET ARASI",
	readyDisplayMinutes: 5,
	textScale: "m",
	theme: "dark",
};

function parsePositiveInt(raw: string | undefined): number | null {
	if (!raw) return null;
	const n = Number(raw);
	if (!Number.isInteger(n) || n <= 0) return null;
	return n;
}

function formatAllowed(values: readonly string[]): string {
	return values.join(", ");
}

export function isDisplaySettingKey(key: string): key is DisplaySettingKey {
	return DISPLAY_SETTING_KEY_SET.has(key);
}

export function parseDisplaySettings(settings: Record<string, string>): DisplayConfig {
	const profileRaw = settings[SETTING_KEYS.DISPLAY_PROFILE];
	const baseProfile: DisplayProfile =
		profileRaw && DISPLAY_PROFILE_SET.has(profileRaw as DisplayProfile)
			? (profileRaw as DisplayProfile)
			: DEFAULT_DISPLAY_CONFIG.profile;

	const defaults = PROFILE_DEFAULTS[baseProfile];
	const layoutRaw = settings[SETTING_KEYS.DISPLAY_LAYOUT];
	const layoutPreference: DisplayLayoutPreference =
		layoutRaw && DISPLAY_LAYOUT_SET.has(layoutRaw as DisplayLayoutPreference)
			? (layoutRaw as DisplayLayoutPreference)
			: defaults.layoutPreference;

	const maxVisible = parsePositiveInt(settings[SETTING_KEYS.DISPLAY_MAX_VISIBLE]);
	const maxVisiblePerColumn = Math.min(99, Math.max(1, maxVisible ?? defaults.maxVisiblePerColumn));

	const pageSecondsRaw = parsePositiveInt(settings[SETTING_KEYS.DISPLAY_PAGE_SECONDS]);
	const pageSeconds = Math.min(120, Math.max(1, pageSecondsRaw ?? defaults.pageSeconds));

	const restaurantName =
		settings[SETTING_KEYS.RESTAURANT_NAME] ?? DEFAULT_DISPLAY_CONFIG.restaurantName;

	const readyDisplayMinutesRaw = parsePositiveInt(settings[SETTING_KEYS.DISPLAY_READY_MINUTES]);
	const readyDisplayMinutes = Math.min(
		60,
		Math.max(1, readyDisplayMinutesRaw ?? DEFAULT_DISPLAY_CONFIG.readyDisplayMinutes),
	);

	const scaleRaw = settings[SETTING_KEYS.DISPLAY_TEXT_SCALE];
	const textScale: DisplayTextScale =
		scaleRaw && DISPLAY_TEXT_SCALE_SET.has(scaleRaw as DisplayTextScale)
			? (scaleRaw as DisplayTextScale)
			: DEFAULT_DISPLAY_CONFIG.textScale;

	const themeRaw = settings[SETTING_KEYS.DISPLAY_THEME];
	const theme: DisplayTheme =
		themeRaw && DISPLAY_THEME_SET.has(themeRaw as DisplayTheme)
			? (themeRaw as DisplayTheme)
			: DEFAULT_DISPLAY_CONFIG.theme;

	return {
		profile: baseProfile,
		layoutPreference,
		maxVisiblePerColumn,
		pageSeconds,
		restaurantName,
		readyDisplayMinutes,
		textScale,
		theme,
	};
}

export function serializeDisplayConfig(config: DisplayConfig): Record<DisplaySettingKey, string> {
	return {
		[SETTING_KEYS.RESTAURANT_NAME]: config.restaurantName,
		[SETTING_KEYS.DISPLAY_PROFILE]: config.profile,
		[SETTING_KEYS.DISPLAY_LAYOUT]: config.layoutPreference,
		[SETTING_KEYS.DISPLAY_MAX_VISIBLE]: String(config.maxVisiblePerColumn),
		[SETTING_KEYS.DISPLAY_PAGE_SECONDS]: String(config.pageSeconds),
		[SETTING_KEYS.DISPLAY_READY_MINUTES]: String(config.readyDisplayMinutes),
		[SETTING_KEYS.DISPLAY_TEXT_SCALE]: config.textScale,
		[SETTING_KEYS.DISPLAY_THEME]: config.theme,
	};
}

export const DEFAULT_DISPLAY_SETTINGS = serializeDisplayConfig(DEFAULT_DISPLAY_CONFIG);

export function areDisplayConfigsEqual(a: DisplayConfig, b: DisplayConfig): boolean {
	const aSerialized = serializeDisplayConfig(a);
	const bSerialized = serializeDisplayConfig(b);
	return DISPLAY_SETTING_KEYS.every((key) => aSerialized[key] === bSerialized[key]);
}

export function validateDisplaySettingValue(key: DisplaySettingKey, value: string): string | null {
	switch (key) {
		case SETTING_KEYS.RESTAURANT_NAME:
			if (value.length > 60) {
				return "restaurant_name must be <= 60 characters";
			}
			return null;
		case SETTING_KEYS.DISPLAY_PROFILE:
			if (!DISPLAY_PROFILE_SET.has(value as DisplayProfile)) {
				return `display_profile must be one of: ${formatAllowed(DISPLAY_PROFILES)}`;
			}
			return null;
		case SETTING_KEYS.DISPLAY_LAYOUT:
			if (!DISPLAY_LAYOUT_SET.has(value as DisplayLayoutPreference)) {
				return `display_layout must be one of: ${formatAllowed(DISPLAY_LAYOUT_PREFERENCES)}`;
			}
			return null;
		case SETTING_KEYS.DISPLAY_MAX_VISIBLE: {
			const maxVisible = Number(value);
			if (!Number.isInteger(maxVisible) || maxVisible < 1 || maxVisible > 99) {
				return "display_max_visible must be an integer between 1 and 99";
			}
			return null;
		}
		case SETTING_KEYS.DISPLAY_PAGE_SECONDS: {
			const pageSeconds = Number(value);
			if (!Number.isInteger(pageSeconds) || pageSeconds < 1 || pageSeconds > 120) {
				return "display_page_seconds must be an integer between 1 and 120";
			}
			return null;
		}
		case SETTING_KEYS.DISPLAY_READY_MINUTES: {
			const minutes = Number(value);
			if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) {
				return "display_ready_minutes must be an integer between 1 and 60";
			}
			return null;
		}
		case SETTING_KEYS.DISPLAY_TEXT_SCALE:
			if (!DISPLAY_TEXT_SCALE_SET.has(value as DisplayTextScale)) {
				return `display_text_scale must be one of: ${formatAllowed(DISPLAY_TEXT_SCALES)}`;
			}
			return null;
		case SETTING_KEYS.DISPLAY_THEME:
			if (!DISPLAY_THEME_SET.has(value as DisplayTheme)) {
				return `display_theme must be one of: ${formatAllowed(DISPLAY_THEMES)}`;
			}
			return null;
		default:
			return "Unknown display setting key";
	}
}
