import { OrderStatus, WS_CHANNELS } from "@sepetarasi/shared";
import type { Order, WsMessage } from "@sepetarasi/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { UI_LABELS } from "../../constants/labels";
import { useWebSocket } from "../../hooks/useWebSocket";
import { api } from "../../lib/api";
import { useOrderStore, useOrdersByStatus } from "../../stores/orderStore";
import {
	DEFAULT_DISPLAY_CONFIG,
	type DisplayConfig,
	getPageCount,
	getPageSlice,
	parseDisplaySettings,
	resolveLayoutMode,
	resolveMaxVisiblePerColumn,
} from "./display-config";

// How long (ms) a READY order stays visible on the customer display after being marked ready.
// After this duration, the order is hidden from the screen automatically — no backend change,
// purely a frontend filter based on ready_at timestamp.
//
// Rationale: In a fast-food context, customers pick up their order within a few minutes.
// Keeping old READY orders on screen indefinitely clutters the display.
//
// To change this behaviour:
//   - Increase/decrease READY_DISPLAY_DURATION_MS for a different timeout
//   - Set to Infinity to disable auto-hide entirely (orders stay until DELIVERED)
//   - Move the filter to the server (e.g. a scheduled job that marks old READY orders as
//     DELIVERED) if you want persistent state change rather than a visual-only hide
const READY_DISPLAY_DURATION_MS = 5 * 60 * 1000; // 5 minutes

function useVisibleReadyOrders(readyOrders: Order[]): Order[] {
	return useMemo(() => {
		const now = Date.now();
		return readyOrders.filter((order) => {
			if (!order.ready_at) return true;
			return now - new Date(order.ready_at).getTime() < READY_DISPLAY_DURATION_MS;
		});
	}, [readyOrders]);
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
		const onResize = () => {
			setViewport({
				width: window.innerWidth,
				height: window.innerHeight,
			});
		};

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

function CountBadge({ count }: { count: number }) {
	return (
		<span className="ml-2 inline-flex items-center justify-center w-[clamp(1.25rem,3vmin,2rem)] h-[clamp(1.25rem,3vmin,2rem)] rounded-full bg-white/20 text-white text-[clamp(0.75rem,2vmin,1rem)] font-bold">
			{count}
		</span>
	);
}

function OrderNumber({
	displayNo,
	highlight,
	layoutMode,
}: {
	displayNo: number;
	highlight?: boolean;
	layoutMode: "stack" | "split";
}) {
	const textClass =
		layoutMode === "stack"
			? "text-[clamp(1.75rem,10vmin,6rem)]"
			: "text-[clamp(1.25rem,8vmin,5rem)]";

	return (
		<div
			className={`rounded-xl px-[clamp(0.25rem,1.5vmin,1.5rem)] py-[clamp(0.125rem,1vmin,1rem)] text-center font-bold ${textClass} transition-all duration-300
					${
						highlight
							? "bg-green-500 text-white scale-110 shadow-lg shadow-green-500/30"
							: "bg-gray-800 text-white"
					}`}
		>
			#{displayNo}
		</div>
	);
}

export function CustomerDisplay() {
	const hydrate = useOrderStore((s) => s.hydrate);
	const applyWsEvent = useOrderStore((s) => s.applyWsEvent);
	const setConnected = useOrderStore((s) => s.setConnected);
	const nowPlaying = useOrderStore((s) => s.nowPlaying);
	const preparingOrders = useOrdersByStatus(OrderStatus.PREPARING);
	const allReadyOrders = useOrdersByStatus(OrderStatus.READY);
	const readyOrders = useVisibleReadyOrders(allReadyOrders);
	const [displayConfig, setDisplayConfig] = useState<DisplayConfig>(DEFAULT_DISPLAY_CONFIG);
	const layoutMode = useDisplayLayoutMode(displayConfig.profile, displayConfig.layoutPreference);
	const isStackLayout = layoutMode === "stack";
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
	const onConnect = useCallback(() => {
		setConnected(true, { includeStatsOnReconnect: false });
	}, [setConnected]);
	const onDisconnect = useCallback(() => setConnected(false), [setConnected]);

	useWebSocket({ channel: WS_CHANNELS.DISPLAY, onMessage, onConnect, onDisconnect });

	useEffect(() => {
		// Customer display can run without admin auth cookie, so skip stats endpoint.
		hydrate(false, false);

		const loadDisplaySettings = () => {
			api
				.getPublicSettings()
				.then((settings) => setDisplayConfig(parseDisplaySettings(settings)))
				.catch((err) => console.error("[CustomerDisplay] getPublicSettings failed:", err));
		};

		loadDisplaySettings();
		const settingsInterval = setInterval(loadDisplaySettings, 30_000);

		return () => {
			clearInterval(settingsInterval);
		};
	}, [hydrate]);

	// Re-render every minute so the auto-hide timer stays accurate.
	// We only need a local re-render — data already stays fresh via WebSocket.
	// Do NOT call hydrate() here; that would fire a full API request every minute unnecessarily.
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
		<div className="min-h-screen bg-gray-950 text-white flex flex-col">
			{/* Now Serving Banner */}
			{nowPlaying && (
				<div className="bg-green-600 text-center py-[clamp(0.5rem,3vmin,2rem)] animate-pulse">
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
					className={`p-[clamp(0.25rem,2vmin,2rem)] ${isStackLayout ? "border-b" : "border-r"} border-gray-800`}
				>
					<h2 className="text-[clamp(1.125rem,4vmin,2rem)] font-bold text-yellow-400 mb-[clamp(0.25rem,2vmin,1.5rem)] text-center uppercase tracking-wider flex items-center justify-center">
						{UI_LABELS.DISPLAY.PREPARING_TITLE}
						<CountBadge count={preparingOrders.length} />
					</h2>
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[clamp(0.125rem,1vmin,1rem)] overflow-hidden">
						{visiblePreparingOrders.map((order) => (
							<OrderNumber key={order.id} displayNo={order.display_no} layoutMode={layoutMode} />
						))}
					</div>
					{preparingOrders.length === 0 && (
						<p className="text-gray-600 text-center text-[clamp(1rem,3vmin,1.5rem)] mt-[clamp(0.5rem,4vmin,3rem)]">
							{UI_LABELS.DISPLAY.NO_PREPARING_ORDERS}
						</p>
					)}
				</div>

				{/* Ready Column */}
				<div className="p-[clamp(0.25rem,2vmin,2rem)]">
					<h2 className="text-[clamp(1.125rem,4vmin,2rem)] font-bold text-green-400 mb-[clamp(0.25rem,2vmin,1.5rem)] text-center uppercase tracking-wider flex items-center justify-center">
						{UI_LABELS.DISPLAY.READY_TITLE}
						<CountBadge count={readyOrders.length} />
					</h2>
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[clamp(0.125rem,1vmin,1rem)] overflow-hidden">
						{visibleReadyOrders.map((order) => (
							<OrderNumber
								key={order.id}
								displayNo={order.display_no}
								highlight={nowPlaying?.order_id === order.id}
								layoutMode={layoutMode}
							/>
						))}
					</div>
					{readyOrders.length === 0 && (
						<p className="text-gray-600 text-center text-[clamp(1rem,3vmin,1.5rem)] mt-[clamp(0.5rem,4vmin,3rem)]">
							{UI_LABELS.DISPLAY.NO_READY_ORDERS}
						</p>
					)}
				</div>
			</div>
			{cyclePageCount > 1 && (
				<div className="text-center text-[clamp(0.75rem,2vmin,1rem)] text-gray-500 py-2">
					{UI_LABELS.DISPLAY.PAGE} {currentCyclePage + 1} / {cyclePageCount}
				</div>
			)}
		</div>
	);
}
