import { SETTING_KEYS, WS_CHANNELS, WS_EVENTS } from "@sepetarasi/shared";
import type { MusicStatus, SettingsUpdatedPayload, WsMessage } from "@sepetarasi/shared";
import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useMusicStore } from "../../stores/musicStore";
import { useOrderStore } from "../../stores/orderStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { AdminHeader } from "./AdminHeader";
import { AudioTab } from "./tabs/AudioTab";
import { DisplayTab } from "./tabs/DisplayTab";
import { NotePresetsTab } from "./tabs/NotePresetsTab";
import { OrdersTab } from "./tabs/OrdersTab";
import { StatsTab } from "./tabs/StatsTab";

export function AdminView() {
	const hydrate = useOrderStore((s) => s.hydrate);
	const applyWsEvent = useOrderStore((s) => s.applyWsEvent);
	const setConnected = useOrderStore((s) => s.setConnected);
	const connected = useOrderStore((s) => s.connected);
	const lastReconnectedAt = useOrderStore((s) => s.lastReconnectedAt);
	const setMusicStatus = useMusicStore((s) => s.setStatus);
	const hydrateSettings = useSettingsStore((s) => s.hydrate);

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
			if (msg.event === WS_EVENTS.MUSIC_STATUS_CHANGED && msg.data) {
				setMusicStatus(msg.data as MusicStatus);
			}
			if (msg.event === WS_EVENTS.SETTINGS_UPDATED) {
				const payload = msg.data as SettingsUpdatedPayload | undefined;
				if (payload?.key === SETTING_KEYS.DELIVERY_TARGET_MINUTES) {
					void hydrateSettings();
					setInternalStatsTrigger((n) => n + 1);
				}
			}
		},
		[applyWsEvent, hydrateSettings, setMusicStatus],
	);

	const onConnect = useCallback(() => setConnected(true), [setConnected]);
	const onDisconnect = useCallback(() => setConnected(false), [setConnected]);

	useWebSocket({ channel: WS_CHANNELS.ORDERS, onMessage, onConnect, onDisconnect });

	useEffect(() => {
		hydrate();
		hydrateSettings();
	}, [hydrate, hydrateSettings]);

	return (
		<div className="min-h-screen bg-slate-900 relative overflow-hidden">
			{/* Ambient Background Globs */}
			<div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
			<div className="absolute bottom-[20%] right-[-10%] w-[30%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

			<div className="relative z-10 min-h-screen flex flex-col">
				<AdminHeader connected={connected} />

				<main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
					<Routes>
						<Route index element={<Navigate to="orders" replace />} />
						<Route path="orders" element={<OrdersTab />} />
						<Route path="audio" element={<AudioTab />} />
						<Route path="display" element={<DisplayTab />} />
						<Route path="notes" element={<NotePresetsTab />} />
						<Route
							path="stats"
							element={
								<StatsTab wsTrigger={internalStatsTrigger} reconnectedAt={lastReconnectedAt} />
							}
						/>
					</Routes>
				</main>
			</div>
		</div>
	);
}
