import { useEffect, useCallback } from "react";
import { OrderStatus, WS_CHANNELS } from "@sepetarasi/shared";
import type { WsMessage } from "@sepetarasi/shared";
import { useOrderStore, useOrdersByStatus } from "../../stores/orderStore";
import { useWebSocket } from "../../hooks/useWebSocket";

function OrderNumber({ displayNo, highlight }: { displayNo: number; highlight?: boolean }) {
	return (
		<div
			className={`rounded-xl px-6 py-4 text-center font-bold text-3xl transition-all duration-300
				${highlight
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
	const readyOrders = useOrdersByStatus(OrderStatus.READY);

	const onMessage = useCallback((msg: WsMessage) => applyWsEvent(msg), [applyWsEvent]);
	const onConnect = useCallback(() => { setConnected(true); hydrate(); }, [setConnected, hydrate]);
	const onDisconnect = useCallback(() => setConnected(false), [setConnected]);

	useWebSocket({ channel: WS_CHANNELS.DISPLAY, onMessage, onConnect, onDisconnect });

	useEffect(() => { hydrate(); }, [hydrate]);

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
					<h2 className="text-xl font-bold text-yellow-400 mb-4 text-center uppercase tracking-wider">
						Hazirlaniyor
					</h2>
					<div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
						{preparingOrders.map((order) => (
							<OrderNumber key={order.id} displayNo={order.display_no} />
						))}
					</div>
					{preparingOrders.length === 0 && (
						<p className="text-gray-600 text-center text-lg mt-8">-</p>
					)}
				</div>

				{/* Ready Column */}
				<div className="p-6">
					<h2 className="text-xl font-bold text-green-400 mb-4 text-center uppercase tracking-wider">
						Hazir
					</h2>
					<div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
						{readyOrders.map((order) => (
							<OrderNumber
								key={order.id}
								displayNo={order.display_no}
								highlight={nowPlaying?.order_id === order.id}
							/>
						))}
					</div>
					{readyOrders.length === 0 && (
						<p className="text-gray-600 text-center text-lg mt-8">-</p>
					)}
				</div>
			</div>
		</div>
	);
}
