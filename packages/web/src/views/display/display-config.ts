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
} from "@sepetarasi/shared";

export type DisplayLayoutMode = "split" | "stack";

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

/** "Şimdi Servis" sırasında hazır numara vurgu animasyonu süresi (saniye) */
export const READY_HIGHLIGHT_ANIMATION_SECONDS = 1;

// ---------------------------------------------------------------------------
// Tema tanımları
// ---------------------------------------------------------------------------

export interface ThemeClasses {
	root: string;
	headerBorder: string;
	restaurantText: string;
	clockText: string;
	preparingCol: string;
	preparingDivider: string;
	readyCol: string;
	preparingTitle: string;
	readyTitle: string;
	preparingEmpty: string;
	readyEmpty: string;
	preparingOrderBadge: string;
	readyOrderBadge: string;
	orderHighlight: string;
	pageIndicator: string;
}

export const THEMES: Record<DisplayTheme, ThemeClasses> = {
	dark: {
		root: "bg-gray-950 text-white",
		headerBorder: "border-gray-800",
		restaurantText: "text-white",
		clockText: "text-slate-200",
		preparingCol: "bg-amber-950/20",
		preparingDivider: "border-amber-900/40",
		readyCol: "bg-green-950/20",
		preparingTitle: "text-yellow-400",
		readyTitle: "text-green-400",
		preparingEmpty: "text-amber-300/80",
		readyEmpty: "text-emerald-300/80",
		preparingOrderBadge: "bg-amber-900/50 text-amber-100 border border-amber-700/50",
		readyOrderBadge: "bg-green-900/50 text-green-100 border border-green-700/50",
		orderHighlight: "bg-green-500 text-white shadow-lg shadow-green-500/50",
		pageIndicator: "text-gray-500",
	},
	// Açık: Beyaz arka plan, koylaştırılmış kontrast, belirgin sütun ayrımı
	light: {
		root: "bg-white text-gray-900",
		headerBorder: "border-gray-200",
		restaurantText: "text-gray-900",
		clockText: "text-gray-600",
		preparingCol: "bg-amber-50",
		preparingDivider: "border-amber-400",
		readyCol: "bg-emerald-50",
		preparingTitle: "text-amber-700",
		readyTitle: "text-emerald-700",
		preparingEmpty: "text-amber-600/80",
		readyEmpty: "text-emerald-600/80",
		preparingOrderBadge: "bg-amber-100 text-amber-900 border border-amber-300 shadow-sm",
		readyOrderBadge: "bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-sm",
		orderHighlight: "bg-emerald-500 text-white shadow-lg shadow-emerald-500/40",
		pageIndicator: "text-gray-400",
	},
	// Vivid: Gerçek koyu arka plan, turuncu/limon sarısı ile güçlü teal kontrast
	vivid: {
		root: "bg-zinc-950 text-white",
		headerBorder: "border-zinc-700",
		restaurantText: "text-white",
		clockText: "text-yellow-300",
		preparingCol: "bg-orange-500/10",
		preparingDivider: "border-orange-500/40",
		readyCol: "bg-teal-500/10",
		preparingTitle: "text-orange-400",
		readyTitle: "text-teal-300",
		preparingEmpty: "text-orange-400/60",
		readyEmpty: "text-teal-400/60",
		preparingOrderBadge: "bg-orange-500/15 text-orange-100 border border-orange-500/40",
		readyOrderBadge: "bg-teal-500/15 text-teal-100 border border-teal-500/40",
		orderHighlight: "bg-teal-400 text-zinc-950 shadow-lg shadow-teal-400/50",
		pageIndicator: "text-zinc-500",
	},
	// Retro: Ekran siyahı üstüne fosforlu yeşil — terminal/arcade hissi
	retro: {
		root: "bg-black text-green-400",
		headerBorder: "border-green-900",
		restaurantText: "text-green-300",
		clockText: "text-green-500",
		preparingCol: "bg-yellow-950/20",
		preparingDivider: "border-yellow-700/40",
		readyCol: "bg-green-950/30",
		preparingTitle: "text-yellow-400",
		readyTitle: "text-green-400",
		preparingEmpty: "text-yellow-700/80",
		readyEmpty: "text-green-700/80",
		preparingOrderBadge: "bg-yellow-950 text-yellow-400 border border-yellow-800",
		readyOrderBadge: "bg-green-950 text-green-400 border border-green-800",
		orderHighlight: "bg-green-500 text-black shadow-lg shadow-green-500/60",
		pageIndicator: "text-green-900",
	},
};

// ---------------------------------------------------------------------------
// Yazı ölçeği tanımları
// ---------------------------------------------------------------------------

export interface TextScaleClasses {
	orderNumberStack: string;
	orderNumberSplit: string;
	columnHeader: string;
}

// S → LED 256x512 gibi dar/küçük ekranlar için. vmin tabanlı ölçek dar ekranda
//     küçük kalır, geniş ekranda sınır değerine (max) yapışır.
// M → Standart TV/monitor. Varsayılan.
// L → Büyük salon TV'leri, uzaktan bakış mesafesi fazla olan mekanlar.
export const TEXT_SCALES: Record<DisplayTextScale, TextScaleClasses> = {
	s: {
		orderNumberStack: "text-[clamp(1rem,9vmin,3.5rem)]",
		orderNumberSplit: "text-[clamp(0.75rem,6vmin,2.5rem)]",
		columnHeader: "text-[clamp(0.875rem,5vmin,1.75rem)]",
	},
	m: {
		orderNumberStack: "text-[clamp(2rem,11vmin,6.75rem)]",
		orderNumberSplit: "text-[clamp(1.375rem,8.75vmin,5.5rem)]",
		columnHeader: "text-[clamp(1.625rem,6.2vmin,3.1rem)]",
	},
	l: {
		orderNumberStack: "text-[clamp(2.5rem,15vmin,9rem)]",
		orderNumberSplit: "text-[clamp(1.75rem,11vmin,7rem)]",
		columnHeader: "text-[clamp(2rem,7.5vmin,4rem)]",
	},
};

// ---------------------------------------------------------------------------
// Parse & utils
// ---------------------------------------------------------------------------

function parsePositiveInt(raw: string | undefined): number | null {
	if (!raw) return null;
	const n = Number(raw);
	if (!Number.isInteger(n) || n <= 0) return null;
	return n;
}

export function parseDisplaySettings(settings: Record<string, string>): DisplayConfig {
	const profileRaw = settings[SETTING_KEYS.DISPLAY_PROFILE];
	const baseProfile: DisplayProfile =
		profileRaw && DISPLAY_PROFILE_SET.has(profileRaw as DisplayProfile)
			? (profileRaw as DisplayProfile)
			: "auto";

	const defaults = PROFILE_DEFAULTS[baseProfile];
	const layoutRaw = settings[SETTING_KEYS.DISPLAY_LAYOUT];
	const layoutPreference: DisplayLayoutPreference =
		layoutRaw && DISPLAY_LAYOUT_SET.has(layoutRaw as DisplayLayoutPreference)
			? (layoutRaw as DisplayLayoutPreference)
			: defaults.layoutPreference;

	const maxVisible = parsePositiveInt(settings[SETTING_KEYS.DISPLAY_MAX_VISIBLE]);
	const maxVisiblePerColumn = Math.max(1, maxVisible ?? defaults.maxVisiblePerColumn);

	const pageSecondsRaw = parsePositiveInt(settings[SETTING_KEYS.DISPLAY_PAGE_SECONDS]);
	const pageSeconds = Math.max(1, pageSecondsRaw ?? defaults.pageSeconds);

	const restaurantName = settings[SETTING_KEYS.RESTAURANT_NAME] ?? "SEPET ARASI";

	const readyDisplayMinutesRaw = parsePositiveInt(settings[SETTING_KEYS.DISPLAY_READY_MINUTES]);
	const readyDisplayMinutes = Math.min(60, Math.max(1, readyDisplayMinutesRaw ?? 5));

	const scaleRaw = settings[SETTING_KEYS.DISPLAY_TEXT_SCALE];
	const textScale: DisplayTextScale =
		scaleRaw && DISPLAY_TEXT_SCALE_SET.has(scaleRaw as DisplayTextScale)
			? (scaleRaw as DisplayTextScale)
			: "m";

	const themeRaw = settings[SETTING_KEYS.DISPLAY_THEME];
	const theme: DisplayTheme =
		themeRaw && DISPLAY_THEME_SET.has(themeRaw as DisplayTheme)
			? (themeRaw as DisplayTheme)
			: "dark";

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

export function resolveLayoutMode(
	width: number,
	height: number,
	config: Pick<DisplayConfig, "profile" | "layoutPreference">,
): DisplayLayoutMode {
	if (config.layoutPreference === "split" || config.layoutPreference === "stack") {
		return config.layoutPreference;
	}
	if (config.profile === "led_256x512") return "stack";
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
