import type {
	DisplayConfig,
	DisplayLayoutPreference,
	DisplayProfile,
	DisplayTextScale,
	DisplayTheme,
} from "@sepetarasi/shared";
export { DEFAULT_DISPLAY_CONFIG, parseDisplaySettings } from "@sepetarasi/shared";
export type { DisplayConfig } from "@sepetarasi/shared";

export type DisplayLayoutMode = "split" | "stack";
export type DisplayChromeDensity = "standard" | "compact";

/** "Şimdi Servis" sırasında hazır numara vurgu animasyonu süresi (saniye) */
export const READY_HIGHLIGHT_ANIMATION_SECONDS = 1;
const COMPACT_LANDSCAPE_MAX_HEIGHT = 260;

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
	preparingRail: string;
	readyRail: string;
	preparingTitle: string;
	readyTitle: string;
	preparingKpiCard: string;
	readyKpiCard: string;
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
		preparingRail: "bg-amber-900/20 border border-amber-700/40",
		readyRail: "bg-emerald-900/20 border border-emerald-700/40",
		preparingTitle: "text-yellow-400",
		readyTitle: "text-green-400",
		preparingKpiCard: "bg-amber-500/15 border border-amber-400/45 text-amber-100",
		readyKpiCard: "bg-emerald-500/15 border border-emerald-400/45 text-emerald-100",
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
		preparingRail: "bg-white/95 border border-amber-200 shadow-sm",
		readyRail: "bg-white/95 border border-emerald-200 shadow-sm",
		preparingTitle: "text-amber-700",
		readyTitle: "text-emerald-700",
		preparingKpiCard: "bg-white border border-amber-300 text-amber-900 shadow-sm",
		readyKpiCard: "bg-white border border-emerald-300 text-emerald-900 shadow-sm",
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
		preparingRail: "bg-orange-500/15 border border-orange-300/45",
		readyRail: "bg-teal-500/15 border border-teal-300/45",
		preparingTitle: "text-orange-400",
		readyTitle: "text-teal-300",
		preparingKpiCard: "bg-orange-500/20 border border-orange-300/60 text-orange-100",
		readyKpiCard: "bg-teal-500/20 border border-teal-300/60 text-teal-100",
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
		preparingCol: "bg-yellow-950/10",
		preparingDivider: "border-yellow-500/50",
		readyCol: "bg-green-950/20",
		preparingRail:
			"bg-yellow-900/30 border-2 border-yellow-500/85 shadow-[0_0_0_1px_rgba(0,0,0,0.65),0_0_18px_rgba(234,179,8,0.15)]",
		readyRail:
			"bg-green-900/30 border-2 border-green-500/85 shadow-[0_0_0_1px_rgba(0,0,0,0.65),0_0_18px_rgba(34,197,94,0.15)]",
		preparingTitle: "text-yellow-300",
		readyTitle: "text-green-300",
		preparingKpiCard:
			"bg-yellow-900/45 border-2 border-yellow-400/80 text-yellow-100 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.35)]",
		readyKpiCard:
			"bg-green-900/45 border-2 border-green-400/80 text-green-100 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.35)]",
		preparingEmpty: "text-yellow-500/85",
		readyEmpty: "text-green-500/85",
		preparingOrderBadge: "bg-yellow-900/45 text-yellow-200 border border-yellow-600/70",
		readyOrderBadge: "bg-green-900/45 text-green-200 border border-green-600/70",
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
	railTitleStack: string;
	railTitleSplit: string;
	railKpiCard: string;
	railKpiNumber: string;
}

// S → LED 256x512 gibi dar/küçük ekranlar için. vmin tabanlı ölçek dar ekranda
//     küçük kalır, geniş ekranda sınır değerine (max) yapışır.
// M → Standart TV/monitor. Varsayılan.
// L → Büyük salon TV'leri, uzaktan bakış mesafesi fazla olan mekanlar.
export const TEXT_SCALES: Record<DisplayTextScale, TextScaleClasses> = {
	xs: {
		orderNumberStack: "text-[clamp(0.9rem,7vmin,2.15rem)]",
		orderNumberSplit: "text-[clamp(0.9rem,5.4vmin,1.6rem)]",
		railTitleStack: "text-[clamp(0.95rem,3.8vmin,1.3rem)]",
		railTitleSplit: "text-[clamp(0.72rem,2.9vmin,0.95rem)]",
		railKpiCard:
			"min-w-[clamp(2.2rem,9vmin,3rem)] h-[clamp(1.35rem,6.2vmin,1.8rem)] px-[clamp(0.35rem,1.4vmin,0.55rem)]",
		railKpiNumber: "text-[clamp(0.78rem,2.8vmin,1rem)]",
	},
	s: {
		orderNumberStack: "text-[clamp(1rem,9vmin,3.5rem)]",
		orderNumberSplit: "text-[clamp(0.75rem,6vmin,2.5rem)]",
		railTitleStack: "text-[clamp(1.65rem,7.4vmin,2.5rem)]",
		railTitleSplit: "text-[clamp(1.55rem,4.1vw,2.2rem)]",
		railKpiCard:
			"min-w-[clamp(5.25rem,13.5vmin,7rem)] h-[clamp(2.75rem,6.5vmin,3.25rem)] px-[clamp(0.65rem,2vmin,1.1rem)]",
		railKpiNumber: "text-[clamp(1.25rem,3.2vw,1.9rem)]",
	},
	m: {
		orderNumberStack: "text-[clamp(2rem,11vmin,6.75rem)]",
		orderNumberSplit: "text-[clamp(1.375rem,8.75vmin,5.5rem)]",
		railTitleStack: "text-[clamp(2rem,6.2vw,3.5rem)]",
		railTitleSplit: "text-[clamp(1.9rem,4.9vw,3.15rem)]",
		railKpiCard:
			"min-w-[clamp(6.25rem,15.5vmin,8.6rem)] h-[clamp(3.15rem,7.4vmin,3.95rem)] px-[clamp(0.8rem,2.25vmin,1.35rem)]",
		railKpiNumber: "text-[clamp(1.5rem,3.9vw,2.6rem)]",
	},
	l: {
		orderNumberStack: "text-[clamp(2.5rem,15vmin,9rem)]",
		orderNumberSplit: "text-[clamp(1.75rem,11vmin,7rem)]",
		railTitleStack: "text-[clamp(2.25rem,7.2vw,4.25rem)]",
		railTitleSplit: "text-[clamp(2.05rem,5.25vw,3.45rem)]",
		railKpiCard:
			"min-w-[clamp(6.7rem,16.3vmin,9.1rem)] h-[clamp(3.3rem,7.9vmin,4.15rem)] px-[clamp(0.9rem,2.35vmin,1.45rem)]",
		railKpiNumber: "text-[clamp(1.6rem,4.15vw,2.7rem)]",
	},
};

interface DisplayProfilePreset {
	layoutPreference: DisplayLayoutPreference;
	maxVisiblePerColumn: number;
	pageSeconds: number;
	textScale: DisplayTextScale;
}

const DISPLAY_PROFILE_PRESETS: Record<Exclude<DisplayProfile, "auto">, DisplayProfilePreset> = {
	led_256x512: {
		layoutPreference: "stack",
		maxVisiblePerColumn: 4,
		pageSeconds: 6,
		textScale: "s",
	},
	led_344_square: {
		layoutPreference: "stack",
		maxVisiblePerColumn: 4,
		pageSeconds: 5,
		textScale: "s",
	},
	led_512_square: {
		layoutPreference: "stack",
		maxVisiblePerColumn: 6,
		pageSeconds: 6,
		textScale: "m",
	},
	tiny_landscape: {
		layoutPreference: "split",
		maxVisiblePerColumn: 2,
		pageSeconds: 5,
		textScale: "xs",
	},
	portrait_compact: {
		layoutPreference: "stack",
		maxVisiblePerColumn: 5,
		pageSeconds: 6,
		textScale: "s",
	},
	tv_1080p: {
		layoutPreference: "split",
		maxVisiblePerColumn: 24,
		pageSeconds: 8,
		textScale: "m",
	},
};

export function isCompactLandscapeViewport(width: number, height: number): boolean {
	return width > height && height <= COMPACT_LANDSCAPE_MAX_HEIGHT;
}

export function getDisplayProfileConfigPreset(
	profile: DisplayProfile,
): Partial<
	Pick<
		DisplayConfig,
		"profile" | "layoutPreference" | "maxVisiblePerColumn" | "pageSeconds" | "textScale"
	>
> {
	if (profile === "auto") return { profile };

	const preset = DISPLAY_PROFILE_PRESETS[profile];
	return {
		profile,
		layoutPreference: preset.layoutPreference,
		maxVisiblePerColumn: preset.maxVisiblePerColumn,
		pageSeconds: preset.pageSeconds,
		textScale: preset.textScale,
	};
}

export function resolveDisplayChromeDensity(
	width: number,
	height: number,
	profile: DisplayConfig["profile"],
): DisplayChromeDensity {
	if (profile === "tiny_landscape") return "compact";
	return isCompactLandscapeViewport(width, height) ? "compact" : "standard";
}

export function shouldUseCompactNowServing(
	width: number,
	height: number,
	profile: DisplayConfig["profile"],
): boolean {
	return resolveDisplayChromeDensity(width, height, profile) === "compact";
}

export function shouldShowDisplayPageIndicator(
	width: number,
	height: number,
	profile: DisplayConfig["profile"],
): boolean {
	return resolveDisplayChromeDensity(width, height, profile) !== "compact";
}

export function resolveLayoutMode(
	width: number,
	height: number,
	config: Pick<DisplayConfig, "profile" | "layoutPreference">,
): DisplayLayoutMode {
	if (config.layoutPreference === "split" || config.layoutPreference === "stack") {
		return config.layoutPreference;
	}
	if (
		config.profile === "led_256x512" ||
		config.profile === "led_344_square" ||
		config.profile === "led_512_square" ||
		config.profile === "portrait_compact"
	) {
		return "stack";
	}
	if (config.profile === "tiny_landscape" || config.profile === "tv_1080p") return "split";
	if (isCompactLandscapeViewport(width, height)) return "split";
	return height > width ? "stack" : "split";
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
