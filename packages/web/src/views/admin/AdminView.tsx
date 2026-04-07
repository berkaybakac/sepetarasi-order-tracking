import { WS_CHANNELS, WS_EVENTS } from "@sepetarasi/shared";
import type { WsMessage } from "@sepetarasi/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { UI_LABELS } from "../../constants/labels";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useOrderStore } from "../../stores/orderStore";
import { OrderColumns, StatCards } from "./OrderColumns";
import { PeriodStats } from "./PeriodStats";
import { VolumeControl } from "./VolumeControl";

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
	const hasConnectedOnceRef = useRef(false);
	// PeriodStats'ı WS eventi sonrası yenileme için sinyal
	const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);

	const onMessage = useCallback(
		(msg: WsMessage) => {
			applyWsEvent(msg);
			if (
				msg.event === WS_EVENTS.ORDER_CREATED ||
				msg.event === WS_EVENTS.ORDER_STATUS_CHANGED ||
				msg.event === WS_EVENTS.STATS_UPDATED
			) {
				setStatsRefreshTrigger((n) => n + 1);
			}
		},
		[applyWsEvent],
	);

	const onConnect = useCallback(() => {
		setConnected(true);
		if (hasConnectedOnceRef.current) {
			hydrate();
		} else {
			hasConnectedOnceRef.current = true;
		}
	}, [setConnected, hydrate]);

	const onDisconnect = useCallback(() => setConnected(false), [setConnected]);

	useWebSocket({ channel: WS_CHANNELS.ORDERS, onMessage, onConnect, onDisconnect });

	useEffect(() => {
		hydrate();
	}, [hydrate]);

	return (
		<div className="min-h-screen bg-brand-bg">
			<header className="bg-brand-surface shadow-sm border-b px-4 py-3">
				<div className="flex items-center justify-between">
					<h1 className="text-xl font-bold text-gray-800">{UI_LABELS.ADMIN_TITLE}</h1>
					<span
						className={`w-2 h-2 rounded-full ${connected ? "bg-brand-success" : "bg-red-500"}`}
					/>
				</div>
			</header>

			<main className="p-4 space-y-6">
				<StatCards />
				<PeriodStats refreshTrigger={statsRefreshTrigger} />
				<VolumeControl />
				<OrderColumns />
			</main>
		</div>
	);
}
