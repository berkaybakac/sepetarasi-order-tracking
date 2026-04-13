import { OrderStatus, WS_CHANNELS } from "@sepetarasi/shared";
import type { Order, WsMessage } from "@sepetarasi/shared";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UI_LABELS } from "../../constants/labels";
import { useWebSocket } from "../../hooks/useWebSocket";
import { api } from "../../lib/api";
import { useOrderStore, useOrdersByStatus } from "../../stores/orderStore";
import {
	DEFAULT_DISPLAY_CONFIG,
	type DisplayConfig,
	READY_HIGHLIGHT_ANIMATION_SECONDS,
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

function ColumnKpiHeader({
	title,
	count,
	railClass,
	titleSizeClass,
	titleClass,
	kpiCardSizeClass,
	kpiCardClass,
	kpiNumberClass,
}: {
	title: string;
	count: number;
	railClass: string;
	titleSizeClass: string;
	titleClass: string;
	kpiCardSizeClass: string;
	kpiCardClass: string;
	kpiNumberClass: string;
}) {
	return (
		<div
			className={`mb-[clamp(0.5rem,2.2vmin,1.6rem)] h-[clamp(5.5rem,11vmin,6.5rem)] rounded-[clamp(0.45rem,1.15vmin,0.7rem)] px-[clamp(0.7rem,2.2vmin,1.5rem)] py-[clamp(0.45rem,1.2vmin,0.85rem)] flex items-center justify-between gap-[clamp(0.75rem,2.5vmin,1.75rem)] ${railClass}`}
		>
			<h2
				className={`${titleSizeClass} font-bold ${titleClass} tracking-[0.02em] leading-[1] -translate-y-[0.03em] min-w-0`}
			>
				{title}
			</h2>
			<div
				className={`shrink-0 inline-flex items-center justify-center rounded-[clamp(0.65rem,1.45vmin,0.85rem)] shadow-lg shadow-black/20 ${kpiCardSizeClass} ${kpiCardClass}`}
			>
				<span className={`font-extrabold tabular-nums leading-none ${kpiNumberClass}`}>
					{count}
				</span>
			</div>
		</div>
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
			className={`aspect-square max-w-[clamp(3rem,16vmin,9rem)] w-full mx-auto rounded-full flex items-center justify-center font-bold tabular-nums ${textClass} ${highlight ? highlightClass : badgeClass}`}
		>
			{displayNo}
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
	const railTitleClass = isStackLayout ? scale.railTitleStack : scale.railTitleSplit;
	const railKpiCardSizeClass = scale.railKpiCard;
	const railKpiNumberClass = scale.railKpiNumber;

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
	const [preparingPage, setPreparingPage] = useState(0);
	const [readyPage, setReadyPage] = useState(0);
	const preparingPageCountRef = useRef(preparingPageCount);
	const readyPageCountRef = useRef(readyPageCount);
	const previousReadyIdsRef = useRef<Set<string>>(new Set());
	const hasReadySnapshotRef = useRef(false);

	useEffect(() => {
		preparingPageCountRef.current = preparingPageCount;
		setPreparingPage((p) => (p >= preparingPageCount ? preparingPageCount - 1 : p));
	}, [preparingPageCount]);

	useEffect(() => {
		readyPageCountRef.current = readyPageCount;
		setReadyPage((p) => (p >= readyPageCount ? readyPageCount - 1 : p));
	}, [readyPageCount]);

	const visiblePreparingOrders = useMemo(
		() => getPageSlice(preparingOrders, maxVisiblePerColumn, preparingPage % preparingPageCount),
		[maxVisiblePerColumn, preparingOrders, preparingPage, preparingPageCount],
	);
	const visibleReadyOrders = useMemo(
		() => getPageSlice(readyOrders, maxVisiblePerColumn, readyPage % readyPageCount),
		[maxVisiblePerColumn, readyOrders, readyPage, readyPageCount],
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

	// Auto-advance both columns independently so one column jump does not disturb the other.
	useEffect(() => {
		const interval = setInterval(() => {
			setPreparingPage((p) => (p + 1) % preparingPageCountRef.current);
			setReadyPage((p) => (p + 1) % readyPageCountRef.current);
		}, displayConfig.pageSeconds * 1000);
		return () => clearInterval(interval);
	}, [displayConfig.pageSeconds]);

	// When ready list gains new items (without announcement), jump ready column to the newest ready order page.
	useEffect(() => {
		const currentReadyIds = new Set(readyOrders.map((order) => order.id));

		if (!hasReadySnapshotRef.current) {
			hasReadySnapshotRef.current = true;
			previousReadyIdsRef.current = currentReadyIds;
			return;
		}

		const previousReadyIds = previousReadyIdsRef.current;
		let newestReadyOrder: Order | null = null;

		for (const order of readyOrders) {
			if (previousReadyIds.has(order.id)) continue;

			if (!newestReadyOrder) {
				newestReadyOrder = order;
				continue;
			}

			const currentReadyAt = order.ready_at ?? "";
			const latestReadyAt = newestReadyOrder.ready_at ?? "";
			if (
				currentReadyAt > latestReadyAt ||
				(currentReadyAt === latestReadyAt && order.display_no > newestReadyOrder.display_no)
			) {
				newestReadyOrder = order;
			}
		}

		previousReadyIdsRef.current = currentReadyIds;
		if (!newestReadyOrder) return;

		const idx = readyOrders.findIndex((order) => order.id === newestReadyOrder.id);
		if (idx < 0) return;

		const targetPage = Math.floor(idx / maxVisiblePerColumn);
		if (targetPage < readyPageCountRef.current) setReadyPage(targetPage);
	}, [readyOrders, maxVisiblePerColumn]);

	// When a new order is announced, jump the ready column to the page that contains it
	const nowPlayingId = nowPlaying?.order_id;
	useEffect(() => {
		if (!nowPlayingId) return;
		const idx = readyOrders.findIndex((o) => o.id === nowPlayingId);
		if (idx < 0) return;
		const targetPage = Math.floor(idx / maxVisiblePerColumn);
		if (targetPage < readyPageCountRef.current) setReadyPage(targetPage);
	}, [nowPlayingId, readyOrders, maxVisiblePerColumn]);

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
					<ColumnKpiHeader
						title={UI_LABELS.DISPLAY.PREPARING_TITLE}
						count={preparingOrders.length}
						railClass={theme.preparingRail}
						titleSizeClass={railTitleClass}
						titleClass={theme.preparingTitle}
						kpiCardSizeClass={railKpiCardSizeClass}
						kpiCardClass={theme.preparingKpiCard}
						kpiNumberClass={railKpiNumberClass}
					/>
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[clamp(0.125rem,1vmin,1rem)] overflow-hidden">
						<AnimatePresence mode="popLayout">
							{visiblePreparingOrders.map((order) => (
								<OrderNumber
									key={order.id}
									displayNo={order.display_no}
									textClass={orderTextClass}
									badgeClass={theme.preparingOrderBadge}
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
					<ColumnKpiHeader
						title={UI_LABELS.DISPLAY.READY_TITLE}
						count={readyOrders.length}
						railClass={theme.readyRail}
						titleSizeClass={railTitleClass}
						titleClass={theme.readyTitle}
						kpiCardSizeClass={railKpiCardSizeClass}
						kpiCardClass={theme.readyKpiCard}
						kpiNumberClass={railKpiNumberClass}
					/>
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[clamp(0.125rem,1vmin,1rem)] overflow-hidden">
						<AnimatePresence mode="popLayout">
							{visibleReadyOrders.map((order) => (
								<OrderNumber
									key={order.id}
									displayNo={order.display_no}
									highlight={nowPlaying?.order_id === order.id}
									textClass={orderTextClass}
									badgeClass={theme.readyOrderBadge}
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

			{(preparingPageCount > 1 || readyPageCount > 1) && (
				<div
					className={`text-center text-[clamp(0.75rem,2vmin,1rem)] py-2 shrink-0 tabular-nums ${theme.pageIndicator}`}
				>
					{UI_LABELS.DISPLAY.PREPARING_TITLE} {preparingPage + 1} / {preparingPageCount} •{" "}
					{UI_LABELS.DISPLAY.READY_TITLE} {readyPage + 1} / {readyPageCount}
				</div>
			)}
		</div>
	);
}
