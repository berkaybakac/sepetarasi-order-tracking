import { OrderStatus, WS_CHANNELS } from "@sepetarasi/shared";
import type { Order, WsMessage } from "@sepetarasi/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useOrderStore, useOrdersByStatus } from "../../stores/orderStore";

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

function CountBadge({ count }: { count: number }) {
	return (
		<span className="ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/20 text-white text-xs font-bold">
			{count}
		</span>
	);
}

function OrderNumber({ displayNo, highlight }: { displayNo: number; highlight?: boolean }) {
	return (
		<div
			className={`rounded-xl px-6 py-4 text-center font-bold text-3xl transition-all duration-300
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

	const onMessage = useCallback((msg: WsMessage) => applyWsEvent(msg), [applyWsEvent]);
	const onConnect = useCallback(() => {
		setConnected(true);
		hydrate();
	}, [setConnected, hydrate]);
	const onDisconnect = useCallback(() => setConnected(false), [setConnected]);

	useWebSocket({ channel: WS_CHANNELS.DISPLAY, onMessage, onConnect, onDisconnect });

	useEffect(() => {
		hydrate();
	}, [hydrate]);

	// Re-render every minute so the auto-hide timer stays accurate.
	// We only need a local re-render — data already stays fresh via WebSocket.
	// Do NOT call hydrate() here; that would fire a full API request every minute unnecessarily.
	const [, tick] = useState(0);
	useEffect(() => {
		const interval = setInterval(() => tick((n) => n + 1), 60_000);
		return () => clearInterval(interval);
	}, []);

	return (
		<div className="min-h-screen bg-gray-950 text-white flex flex-col">
			{/* Now Serving Banner */}
			{nowPlaying && (
				<div className="bg-green-600 text-center py-6 animate-pulse">
					<p className="text-2xl font-medium">Simdi Servis</p>
					<p className="text-7xl font-bold mt-2">#{nowPlaying.display_no}</p>
				</div>
			)}

			{/* Main Grid */}
			<div className="flex-1 grid grid-cols-2 gap-0">
				{/* Preparing Column */}
				<div className="p-6 border-r border-gray-800">
					<h2 className="text-xl font-bold text-yellow-400 mb-4 text-center uppercase tracking-wider flex items-center justify-center">
						Hazirlaniyor
						<CountBadge count={preparingOrders.length} />
					</h2>
					<div className="grid grid-cols-2 md:grid-cols-3 gap-3">
						{preparingOrders.map((order) => (
							<OrderNumber key={order.id} displayNo={order.display_no} />
						))}
					</div>
					{preparingOrders.length === 0 && (
						<p className="text-gray-600 text-center text-lg mt-8">Hazırlanıyor sipariş yok</p>
					)}
				</div>

				{/* Ready Column */}
				<div className="p-6">
					<h2 className="text-xl font-bold text-green-400 mb-4 text-center uppercase tracking-wider flex items-center justify-center">
						Hazir
						<CountBadge count={readyOrders.length} />
					</h2>
					<div className="grid grid-cols-2 md:grid-cols-3 gap-3">
						{readyOrders.map((order) => (
							<OrderNumber
								key={order.id}
								displayNo={order.display_no}
								highlight={nowPlaying?.order_id === order.id}
							/>
						))}
					</div>
					{readyOrders.length === 0 && (
						<p className="text-gray-600 text-center text-lg mt-8">Hazır sipariş yok</p>
					)}
				</div>
			</div>
		</div>
	);
}
