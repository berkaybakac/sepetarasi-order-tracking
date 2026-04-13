import { OrderStatus, WS_CHANNELS } from "@sepetarasi/shared";
import type { Order, WsMessage } from "@sepetarasi/shared";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { UI_LABELS } from "../../constants/labels";
import { useWebSocket } from "../../hooks/useWebSocket";
import { api } from "../../lib/api";
import { useOrderStore, useOrdersByStatus } from "../../stores/orderStore";
import {
	DEFAULT_DISPLAY_CONFIG,
	READY_HIGHLIGHT_ANIMATION_SECONDS,
	type DisplayConfig,
	TEXT_SCALES,
	THEMES,
	getPageCount,
	getPageSlice,
	parseDisplaySettings,
	resolveLayoutMode,
	resolveMaxVisiblePerColumn,
} from "./display-config";

function useVisibleReadyOrders(readyOrders: Order[], readyDisplayMinutes: number): Order[] {
	return useMemo(() => {
		const now = Date.now();
		const durationMs = readyDisplayMinutes * 60 * 1000;
		return readyOrders.filter((order) => {
			if (!order.ready_at) return true;
			return now - new Date(order.ready_at).getTime() < durationMs;
		});
	}, [readyOrders, readyDisplayMinutes]);
}

function useDisplayLayoutMode(
	profile: DisplayConfig["profile"],
	layoutPreference: DisplayConfig["layoutPreference"],
) {
	const [viewport, setViewport] = useState(() => ({
		width: window.innerWidth,
		height: window.innerHeight,
	}));

	useEffect(() => {
		const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);

	return useMemo(() => {
		const searchParams = new URLSearchParams(window.location.search);
		const layoutParam = searchParams.get("layout");
		if (layoutParam === "stack") return "stack" as const;
		if (layoutParam === "split") return "split" as const;
		return resolveLayoutMode(viewport.width, viewport.height, { profile, layoutPreference });
	}, [layoutPreference, profile, viewport.height, viewport.width]);
}

function ClockText({ className }: { className: string }) {
	const [time, setTime] = useState(() => new Date());
	useEffect(() => {
		const id = setInterval(() => setTime(new Date()), 1000);
		return () => clearInterval(id);
	}, []);
	return (
		<span className={className}>
			{time.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", hour12: false })}
		</span>
	);
}

function CountBadge({ count }: { count: number }) {
	if (count === 0) return null;
	return (
		<span className="ml-2 inline-flex items-center justify-center w-[clamp(1.25rem,3vmin,2rem)] h-[clamp(1.25rem,3vmin,2rem)] rounded-full bg-white/20 text-[clamp(0.75rem,2vmin,1rem)] font-bold">
			{count}
		</span>
	);
}

function OrderNumber({
	displayNo,
	highlight,
	textClass,
	badgeClass,
	highlightClass,
}: {
	displayNo: number;
	highlight?: boolean;
	textClass: string;
	badgeClass: string;
	highlightClass: string;
}) {
	return (
		<motion.div
			layout
			layoutId={`order-${displayNo}`}
			// Assumes `nowPlaying` transitions true -> false between announcements.
			// If future WS flow can emit repeated true for the same order without reset,
			// switch to imperative controls.start() to force re-trigger.
			animate={
				highlight
					? {
							opacity: 1,
							y: 0,
							scale: [1, 1.45, 1.1, 1.0],
							transition: {
								duration: READY_HIGHLIGHT_ANIMATION_SECONDS,
								ease: "easeInOut",
							},
						}
					: { opacity: 1, y: 0, scale: 1 }
			}
			initial={{ opacity: 0, scale: 0.75, y: 24 }}
			exit={{ opacity: 0, scale: 0.6, y: -16, transition: { duration: 0.2 } }}
			transition={{ type: "spring", stiffness: 300, damping: 25 }}
			className={`rounded-xl px-[clamp(0.25rem,1.5vmin,1.5rem)] py-[clamp(0.125rem,1vmin,1rem)] text-center font-bold ${textClass} ${highlight ? highlightClass : badgeClass}`}
		>
			#{displayNo}
		</motion.div>
	);
}

export function CustomerDisplay() {
	const hydrate = useOrderStore((s) => s.hydrate);
	const applyWsEvent = useOrderStore((s) => s.applyWsEvent);
	const setConnected = useOrderStore((s) => s.setConnected);
	const nowPlaying = useOrderStore((s) => s.nowPlaying);
	const [displayConfig, setDisplayConfig] = useState<DisplayConfig>(DEFAULT_DISPLAY_CONFIG);
	const preparingOrders = useOrdersByStatus(OrderStatus.PREPARING);
	const allReadyOrders = useOrdersByStatus(OrderStatus.READY);
	const readyOrders = useVisibleReadyOrders(allReadyOrders, displayConfig.readyDisplayMinutes);
	const layoutMode = useDisplayLayoutMode(displayConfig.profile, displayConfig.layoutPreference);
	const isStackLayout = layoutMode === "stack";

	const theme = THEMES[displayConfig.theme];
	const scale = TEXT_SCALES[displayConfig.textScale];
	const orderTextClass = isStackLayout ? scale.orderNumberStack : scale.orderNumberSplit;

	const maxVisiblePerColumn = useMemo(
		() => resolveMaxVisiblePerColumn(displayConfig),
		[displayConfig],
	);
	const preparingPageCount = useMemo(
		() => getPageCount(preparingOrders.length, maxVisiblePerColumn),
		[maxVisiblePerColumn, preparingOrders.length],
	);
	const readyPageCount = useMemo(
		() => getPageCount(readyOrders.length, maxVisiblePerColumn),
		[maxVisiblePerColumn, readyOrders.length],
	);
	const cyclePageCount = Math.max(preparingPageCount, readyPageCount);
	const [pageTick, setPageTick] = useState(0);
	const currentCyclePage = pageTick % cyclePageCount;
	const visiblePreparingOrders = useMemo(
		() => getPageSlice(preparingOrders, maxVisiblePerColumn, currentCyclePage % preparingPageCount),
		[currentCyclePage, maxVisiblePerColumn, preparingOrders, preparingPageCount],
	);
	const visibleReadyOrders = useMemo(
		() => getPageSlice(readyOrders, maxVisiblePerColumn, currentCyclePage % readyPageCount),
		[currentCyclePage, maxVisiblePerColumn, readyOrders, readyPageCount],
	);

	const onMessage = useCallback((msg: WsMessage) => applyWsEvent(msg), [applyWsEvent]);
	const onConnect = useCallback(
		() => setConnected(true, { includeStatsOnReconnect: false }),
		[setConnected],
	);
	const onDisconnect = useCallback(() => setConnected(false), [setConnected]);

	useWebSocket({ channel: WS_CHANNELS.DISPLAY, onMessage, onConnect, onDisconnect });

	useEffect(() => {
		hydrate(false, false);

		const loadDisplaySettings = () => {
			api
				.getPublicSettings()
				.then((settings) => setDisplayConfig(parseDisplaySettings(settings)))
				.catch((err) => console.error("[CustomerDisplay] getPublicSettings failed:", err));
		};

		loadDisplaySettings();
		const settingsInterval = setInterval(loadDisplaySettings, 30_000);
		return () => clearInterval(settingsInterval);
	}, [hydrate]);

	// Re-render every minute so the auto-hide timer stays accurate.
	const [, tick] = useState(0);
	useEffect(() => {
		const interval = setInterval(() => tick((n) => n + 1), 60_000);
		return () => clearInterval(interval);
	}, []);

	useEffect(() => {
		setPageTick(0);
		const interval = setInterval(() => setPageTick((n) => n + 1), displayConfig.pageSeconds * 1000);
		return () => clearInterval(interval);
	}, [displayConfig.pageSeconds]);

	return (
		<div className={`min-h-screen flex flex-col ${theme.root}`}>
			{/* Header: restoran adı + dijital saat */}
			<header
				className={`flex items-center justify-between px-[clamp(1rem,3vmin,3rem)] py-[clamp(0.5rem,1.5vmin,1.25rem)] border-b-2 ${theme.headerBorder} shrink-0`}
			>
				<span
					className={`text-[clamp(1.15rem,4vmin,2.35rem)] font-bold tracking-wide ${theme.restaurantText}`}
				>
					{displayConfig.restaurantName || null}
				</span>
				<ClockText
					className={`font-mono tabular-nums text-[clamp(1.4rem,4.75vmin,2.9rem)] font-semibold ${theme.clockText}`}
				/>
			</header>

			{/* Now Serving Banner */}
			{nowPlaying && (
				<div className="bg-green-600 text-white text-center py-[clamp(0.5rem,3vmin,2rem)] animate-pulse shrink-0">
					<p className="text-[clamp(1.125rem,5vmin,2.5rem)] font-medium">
						{UI_LABELS.DISPLAY.NOW_SERVING}
					</p>
					<p className="text-[clamp(2rem,18vmin,10rem)] font-bold mt-[clamp(0.125rem,1vmin,0.5rem)]">
						#{nowPlaying.display_no}
					</p>
				</div>
			)}

			{/* Main Grid */}
			<div
				className={`flex-1 grid gap-0 ${isStackLayout ? "grid-cols-1 grid-rows-2" : "grid-cols-2"}`}
			>
				{/* Preparing Column */}
				<div
					className={`p-[clamp(0.25rem,2vmin,2rem)] ${theme.preparingCol} ${isStackLayout ? "border-b-2" : "border-r-2"} ${theme.preparingDivider}`}
				>
					<h2
						className={`${scale.columnHeader} font-bold ${theme.preparingTitle} mb-[clamp(0.25rem,2vmin,1.5rem)] text-center uppercase tracking-wider flex items-center justify-center`}
					>
						{UI_LABELS.DISPLAY.PREPARING_TITLE}
						<CountBadge count={preparingOrders.length} />
					</h2>
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[clamp(0.125rem,1vmin,1rem)] overflow-hidden">
						<AnimatePresence mode="popLayout">
							{visiblePreparingOrders.map((order) => (
								<OrderNumber
									key={order.id}
									displayNo={order.display_no}
									textClass={orderTextClass}
									badgeClass={theme.orderBadge}
									highlightClass={theme.orderHighlight}
								/>
							))}
						</AnimatePresence>
					</div>
					{preparingOrders.length === 0 && (
						<p
							className={`text-center text-[clamp(1rem,3vmin,1.5rem)] mt-[clamp(0.5rem,4vmin,3rem)] ${theme.preparingEmpty}`}
						>
							{UI_LABELS.DISPLAY.NO_PREPARING_ORDERS}
						</p>
					)}
				</div>

				{/* Ready Column */}
				<div className={`p-[clamp(0.25rem,2vmin,2rem)] ${theme.readyCol}`}>
					<h2
						className={`${scale.columnHeader} font-bold ${theme.readyTitle} mb-[clamp(0.25rem,2vmin,1.5rem)] text-center uppercase tracking-wider flex items-center justify-center`}
					>
						{UI_LABELS.DISPLAY.READY_TITLE}
						<CountBadge count={readyOrders.length} />
					</h2>
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[clamp(0.125rem,1vmin,1rem)] overflow-hidden">
						<AnimatePresence mode="popLayout">
							{visibleReadyOrders.map((order) => (
								<OrderNumber
									key={order.id}
									displayNo={order.display_no}
									highlight={nowPlaying?.order_id === order.id}
									textClass={orderTextClass}
									badgeClass={theme.orderBadge}
									highlightClass={theme.orderHighlight}
								/>
							))}
						</AnimatePresence>
					</div>
					{readyOrders.length === 0 && (
						<p
							className={`text-center text-[clamp(1rem,3vmin,1.5rem)] mt-[clamp(0.5rem,4vmin,3rem)] ${theme.readyEmpty}`}
						>
							{UI_LABELS.DISPLAY.NO_READY_ORDERS}
						</p>
					)}
				</div>
			</div>

			{cyclePageCount > 1 && (
				<div
					className={`text-center text-[clamp(0.75rem,2vmin,1rem)] py-2 shrink-0 ${theme.pageIndicator}`}
				>
					{UI_LABELS.DISPLAY.PAGE} {currentCyclePage + 1} / {cyclePageCount}
				</div>
			)}
		</div>
	);
}
