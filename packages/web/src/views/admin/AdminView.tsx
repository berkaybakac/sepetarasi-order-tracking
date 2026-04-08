import { WS_CHANNELS, WS_EVENTS } from "@sepetarasi/shared";
import type { WsMessage } from "@sepetarasi/shared";
import { useCallback, useEffect, useState } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useOrderStore } from "../../stores/orderStore";
import { OrderColumns, StatCards } from "./OrderColumns";
import { PeriodStats } from "./PeriodStats";
import { VolumeControl } from "./VolumeControl";

import { AdminHeader } from "./AdminHeader";

/**
 * AdminView — orkestratör.
 * Tek sorumluluk: WebSocket bağlantısını yönet, layout'u oluştur.
 * İş mantığı her section'ın kendi dosyasında.
 */
export function AdminView() {
	const hydrate = useOrderStore((s) => s.hydrate);
	const applyWsEvent = useOrderStore((s) => s.applyWsEvent);
	const setConnected = useOrderStore((s) => s.setConnected);
	const connected = useOrderStore((s) => s.connected);
	const lastReconnectedAt = useOrderStore((s) => s.lastReconnectedAt);

	// Local trigger for WS events (not reconnects)
	const [internalStatsTrigger, setInternalStatsTrigger] = useState(0);

	const onMessage = useCallback(
		(msg: WsMessage) => {
			applyWsEvent(msg);
			if (
				msg.event === WS_EVENTS.ORDER_CREATED ||
				msg.event === WS_EVENTS.ORDER_STATUS_CHANGED ||
				msg.event === WS_EVENTS.STATS_UPDATED
			) {
				setInternalStatsTrigger((n) => n + 1);
			}
		},
		[applyWsEvent],
	);

	const onConnect = useCallback(() => setConnected(true), [setConnected]);
	const onDisconnect = useCallback(() => setConnected(false), [setConnected]);

	useWebSocket({ channel: WS_CHANNELS.ORDERS, onMessage, onConnect, onDisconnect });

	useEffect(() => {
		hydrate();
	}, [hydrate]);

	return (
		<div className="min-h-screen bg-slate-900 relative overflow-hidden">
			{/* Ambient Background Globs */}
			<div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
			<div className="absolute bottom-[20%] right-[-10%] w-[30%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

			<div className="relative z-10 min-h-screen flex flex-col">
				<AdminHeader connected={connected} />

				<main className="flex-1 p-4 md:p-6 space-y-6 max-w-7xl mx-auto w-full">
					<StatCards />
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<PeriodStats wsTrigger={internalStatsTrigger} reconnectedAt={lastReconnectedAt} />
						<VolumeControl />
					</div>
					<OrderColumns />
				</main>
			</div>
		</div>
	);
}
