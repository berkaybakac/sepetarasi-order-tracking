import { SETTING_KEYS } from "@sepetarasi/shared";

export type DisplayProfile = "auto" | "led_256x512" | "tv_1080p";
export type DisplayLayoutPreference = "auto" | "split" | "stack";
export type DisplayLayoutMode = "split" | "stack";

export interface DisplayConfig {
	profile: DisplayProfile;
	layoutPreference: DisplayLayoutPreference;
	maxVisiblePerColumn: number;
	pageSeconds: number;
}

const PROFILE_DEFAULTS: Record<DisplayProfile, Omit<DisplayConfig, "profile">> = {
	auto: {
		layoutPreference: "auto",
		maxVisiblePerColumn: 20,
		pageSeconds: 8,
	},
	led_256x512: {
		layoutPreference: "stack",
		maxVisiblePerColumn: 4,
		pageSeconds: 6,
	},
	tv_1080p: {
		layoutPreference: "split",
		maxVisiblePerColumn: 24,
		pageSeconds: 8,
	},
};

export const DEFAULT_DISPLAY_CONFIG: DisplayConfig = {
	profile: "auto",
	...PROFILE_DEFAULTS.auto,
};

function parsePositiveInt(raw: string | undefined): number | null {
	if (!raw) return null;
	const n = Number(raw);
	if (!Number.isInteger(n) || n <= 0) return null;
	return n;
}

export function parseDisplaySettings(settings: Record<string, string>): DisplayConfig {
	const profile = (settings[SETTING_KEYS.DISPLAY_PROFILE] as DisplayProfile | undefined) ?? "auto";
	const baseProfile: DisplayProfile =
		profile === "auto" || profile === "led_256x512" || profile === "tv_1080p" ? profile : "auto";

	const defaults = PROFILE_DEFAULTS[baseProfile];
	const layoutRaw = settings[SETTING_KEYS.DISPLAY_LAYOUT];
	const layoutPreference: DisplayLayoutPreference =
		layoutRaw === "auto" || layoutRaw === "split" || layoutRaw === "stack"
			? layoutRaw
			: defaults.layoutPreference;

	const maxVisible = parsePositiveInt(settings[SETTING_KEYS.DISPLAY_MAX_VISIBLE]);
	const maxVisiblePerColumn = Math.max(1, maxVisible ?? defaults.maxVisiblePerColumn);

	const pageSecondsRaw = parsePositiveInt(settings[SETTING_KEYS.DISPLAY_PAGE_SECONDS]);
	const pageSeconds = Math.max(1, pageSecondsRaw ?? defaults.pageSeconds);

	return {
		profile: baseProfile,
		layoutPreference,
		maxVisiblePerColumn,
		pageSeconds,
	};
}

export function resolveLayoutMode(
	width: number,
	height: number,
	config: Pick<DisplayConfig, "profile" | "layoutPreference">,
): DisplayLayoutMode {
	if (config.layoutPreference === "split" || config.layoutPreference === "stack") {
		return config.layoutPreference;
	}

	if (config.profile === "led_256x512") {
		return "stack";
	}

	return width < 840 || height > width ? "stack" : "split";
}

export function resolveMaxVisiblePerColumn(config: DisplayConfig): number {
	return Math.max(1, config.maxVisiblePerColumn);
}

export function getPageCount(totalItems: number, pageSize: number): number {
	if (totalItems <= 0) return 1;
	return Math.max(1, Math.ceil(totalItems / Math.max(1, pageSize)));
}

export function getPageSlice<T>(items: T[], pageSize: number, pageIndex: number): T[] {
	const safePageSize = Math.max(1, pageSize);
	const totalPages = getPageCount(items.length, safePageSize);
	const boundedPage = ((pageIndex % totalPages) + totalPages) % totalPages;
	const start = boundedPage * safePageSize;
	return items.slice(start, start + safePageSize);
}
