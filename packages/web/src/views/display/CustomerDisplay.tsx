import { OrderStatus, WS_CHANNELS } from "@sepetarasi/shared";
import type { WsMessage } from "@sepetarasi/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { UI_LABELS } from "../../constants/labels";
import { useBootScreenReady } from "../../hooks/useBootScreenReady";
import { useInterval } from "../../hooks/useInterval";
import { useWebSocket } from "../../hooks/useWebSocket";
import { api } from "../../lib/api";
import { logger } from "../../lib/logger";
import { useOrderStore, useOrdersByStatus } from "../../stores/orderStore";
import {
	ClockText,
	OrdersColumn,
	useDisplayLayoutMode,
	useVisibleReadyOrders,
} from "./customer-display-parts";
import {
	DEFAULT_DISPLAY_CONFIG,
	type DisplayConfig,
	TEXT_SCALES,
	THEMES,
	getPageCount,
	getPageSlice,
	parseDisplaySettings,
	resolveMaxVisiblePerColumn,
} from "./display-config";
import { resolveDisplayConfigWithUrlOverrides } from "./display-url-overrides";
import { advancePage, findNewestNewReadyOrderPage, findOrderPageById } from "./pagination-logic";

const FALLBACK_POLL_DELAYS_MS = [3_000, 6_000, 10_000] as const;

export function CustomerDisplay() {
	const location = useLocation();
	const isDisplayShellRoute = location.pathname === "/display" || location.pathname === "/display/";
	const hydrate = useOrderStore((s) => s.hydrate);
	const applyWsEvent = useOrderStore((s) => s.applyWsEvent);
	const setConnected = useOrderStore((s) => s.setConnected);
	const connected = useOrderStore((s) => s.connected);
	const isHydrating = useOrderStore((s) => s.isHydrating);
	const clearNowPlaying = useOrderStore((s) => s.clearNowPlaying);
	const nowPlaying = useOrderStore((s) => s.nowPlaying);
	const [displayConfig, setDisplayConfig] = useState<DisplayConfig>(DEFAULT_DISPLAY_CONFIG);
	const [pollBackoffIndex, setPollBackoffIndex] = useState(0);
	const effectiveConfig = useMemo(
		() => resolveDisplayConfigWithUrlOverrides(displayConfig, location.search),
		[displayConfig, location.search],
	);
	const preparingOrders = useOrdersByStatus(OrderStatus.PREPARING);
	const allReadyOrders = useOrdersByStatus(OrderStatus.READY);
	const readyOrders = useVisibleReadyOrders(allReadyOrders, effectiveConfig.readyDisplayMinutes);
	const layoutMode = useDisplayLayoutMode(
		effectiveConfig.profile,
		effectiveConfig.layoutPreference,
	);
	const isStackLayout = layoutMode === "stack";

	const theme = THEMES[effectiveConfig.theme];
	const scale = TEXT_SCALES[effectiveConfig.textScale];
	const orderTextClass = isStackLayout ? scale.orderNumberStack : scale.orderNumberSplit;
	const railTitleClass = isStackLayout ? scale.railTitleStack : scale.railTitleSplit;
	const railKpiCardSizeClass = scale.railKpiCard;
	const railKpiNumberClass = scale.railKpiNumber;

	const maxVisiblePerColumn = useMemo(
		() => resolveMaxVisiblePerColumn(effectiveConfig),
		[effectiveConfig],
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
	const [initialLoadSettled, setInitialLoadSettled] = useState(false);
	const preparingPageCountRef = useRef(preparingPageCount);
	const readyPageCountRef = useRef(readyPageCount);
	const previousReadyIdsRef = useRef<Set<string>>(new Set());
	const hasReadySnapshotRef = useRef(false);
	const previousConnectedRef = useRef(connected);

	useBootScreenReady(initialLoadSettled, { disabled: isDisplayShellRoute });

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
		let cancelled = false;

		const loadInitialState = async () => {
			const settingsRequest = api
				.getPublicSettings()
				.then((settings) => setDisplayConfig(parseDisplaySettings(settings)))
				.catch((error) =>
					logger.error("CustomerDisplay", "Failed to load public display settings.", error),
				);

			await Promise.allSettled([hydrate(false, false), settingsRequest]);
			if (!cancelled) {
				setInitialLoadSettled(true);
			}
		};

		void loadInitialState();

		return () => {
			cancelled = true;
		};
	}, [hydrate]);

	useEffect(() => {
		if (connected) {
			setPollBackoffIndex(0);
			previousConnectedRef.current = true;
			return;
		}

		if (previousConnectedRef.current) {
			clearNowPlaying();
			if (!isHydrating) {
				void hydrate(true, false, { retryCount: 0 }).then((success) => {
					setPollBackoffIndex(success ? 0 : 1);
				});
			}
		}

		previousConnectedRef.current = false;
	}, [clearNowPlaying, connected, hydrate, isHydrating]);

	useInterval(
		() => {
			if (connected || isHydrating) return;

			void hydrate(true, false, { retryCount: 0 }).then((success) => {
				setPollBackoffIndex((current) => {
					if (success) return 0;
					return Math.min(current + 1, FALLBACK_POLL_DELAYS_MS.length - 1);
				});
			});
		},
		connected ? null : FALLBACK_POLL_DELAYS_MS[pollBackoffIndex],
	);

	useInterval(() => {
		api
			.getPublicSettings()
			.then((settings) => setDisplayConfig(parseDisplaySettings(settings)))
			.catch((error) =>
				logger.error("CustomerDisplay", "Failed to refresh public display settings.", error),
			);
	}, 30_000);

	// Re-render every minute so the auto-hide timer stays accurate.
	const [, tick] = useState(0);
	useInterval(() => tick((n) => n + 1), 60_000);

	// Auto-advance both columns independently so one column jump does not disturb the other.
	useInterval(() => {
		setPreparingPage((p) => advancePage(p, preparingPageCountRef.current));
		setReadyPage((p) => advancePage(p, readyPageCountRef.current));
	}, effectiveConfig.pageSeconds * 1000);

	// When ready list gains new items (without announcement), jump ready column to the newest ready order page.
	useEffect(() => {
		const currentReadyIds = new Set(readyOrders.map((order) => order.id));

		if (!hasReadySnapshotRef.current) {
			hasReadySnapshotRef.current = true;
			previousReadyIdsRef.current = currentReadyIds;
			return;
		}

		const previousReadyIds = previousReadyIdsRef.current;
		const targetPage = findNewestNewReadyOrderPage(
			readyOrders,
			previousReadyIds,
			maxVisiblePerColumn,
		);
		previousReadyIdsRef.current = currentReadyIds;
		if (targetPage !== null && targetPage < readyPageCountRef.current) setReadyPage(targetPage);
	}, [readyOrders, maxVisiblePerColumn]);

	// When a new order is announced, jump the ready column to the page that contains it
	const nowPlayingId = nowPlaying?.order_id;
	useEffect(() => {
		if (!nowPlayingId) return;
		const targetPage = findOrderPageById(readyOrders, nowPlayingId, maxVisiblePerColumn);
		if (targetPage !== null && targetPage < readyPageCountRef.current) setReadyPage(targetPage);
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
					{effectiveConfig.restaurantName || null}
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
				<OrdersColumn
					containerClass={`p-[clamp(0.25rem,2vmin,2rem)] overflow-hidden min-h-0 ${theme.preparingCol} ${isStackLayout ? "border-b-2" : "border-r-2"} ${theme.preparingDivider}`}
					title={UI_LABELS.DISPLAY.PREPARING_TITLE}
					count={preparingOrders.length}
					railClass={theme.preparingRail}
					titleSizeClass={railTitleClass}
					titleClass={theme.preparingTitle}
					kpiCardSizeClass={railKpiCardSizeClass}
					kpiCardClass={theme.preparingKpiCard}
					kpiNumberClass={railKpiNumberClass}
					orders={visiblePreparingOrders}
					orderTextClass={orderTextClass}
					badgeClass={theme.preparingOrderBadge}
					highlightClass={theme.orderHighlight}
					emptyText={UI_LABELS.DISPLAY.NO_PREPARING_ORDERS}
					emptyTextClass={theme.preparingEmpty}
				/>
				<OrdersColumn
					containerClass={`p-[clamp(0.25rem,2vmin,2rem)] overflow-hidden min-h-0 ${theme.readyCol}`}
					title={UI_LABELS.DISPLAY.READY_TITLE}
					count={readyOrders.length}
					railClass={theme.readyRail}
					titleSizeClass={railTitleClass}
					titleClass={theme.readyTitle}
					kpiCardSizeClass={railKpiCardSizeClass}
					kpiCardClass={theme.readyKpiCard}
					kpiNumberClass={railKpiNumberClass}
					orders={visibleReadyOrders}
					orderTextClass={orderTextClass}
					badgeClass={theme.readyOrderBadge}
					highlightClass={theme.orderHighlight}
					highlightOrderId={nowPlayingId}
					emptyText={UI_LABELS.DISPLAY.NO_READY_ORDERS}
					emptyTextClass={theme.readyEmpty}
				/>
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
