import { SETTING_KEYS, WS_CHANNELS, WS_EVENTS } from "@sepetarasi/shared";
import type { MusicStatus, SettingsUpdatedPayload, WsMessage } from "@sepetarasi/shared";
import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useBootScreenReady } from "../../hooks/useBootScreenReady";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useMusicStore } from "../../stores/musicStore";
import { useOrderStore } from "../../stores/orderStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { AdminHeader } from "./AdminHeader";
import { ADMIN_TABS } from "./admin-tabs";
import { AudioTab } from "./tabs/AudioTab";
import { DisplayTab } from "./tabs/DisplayTab";
import { NotePresetsTab } from "./tabs/NotePresetsTab";
import { OrdersTab } from "./tabs/OrdersTab";
import { StatsTab } from "./tabs/StatsTab";
import { AppShell } from "./ui/primitives";

export function AdminView() {
	const location = useLocation();
	const hydrate = useOrderStore((s) => s.hydrate);
	const applyWsEvent = useOrderStore((s) => s.applyWsEvent);
	const setConnected = useOrderStore((s) => s.setConnected);
	const lastReconnectedAt = useOrderStore((s) => s.lastReconnectedAt);
	const setMusicStatus = useMusicStore((s) => s.setStatus);
	const hydrateSettings = useSettingsStore((s) => s.hydrate);

	const [internalStatsTrigger, setInternalStatsTrigger] = useState(0);
	const [initialHydrationReady, setInitialHydrationReady] = useState(false);

	const activeTab = useMemo(() => {
		const matched = ADMIN_TABS.find((tab) => location.pathname === tab.to);
		return matched?.to.split("/").at(-1) ?? null;
	}, [location.pathname]);
	const [mountedTabs, setMountedTabs] = useState<string[]>(() => [activeTab ?? "orders"]);

	const onMessage = useCallback(
		(msg: WsMessage) => {
			applyWsEvent(msg);
			if (
				msg.event === WS_EVENTS.ORDER_CREATED ||
				msg.event === WS_EVENTS.ORDER_STATUS_CHANGED ||
				msg.event === WS_EVENTS.STATS_UPDATED
			) {
				startTransition(() => setInternalStatsTrigger((n) => n + 1));
			}
			if (msg.event === WS_EVENTS.MUSIC_STATUS_CHANGED && msg.data) {
				setMusicStatus(msg.data as MusicStatus);
			}
			if (msg.event === WS_EVENTS.SETTINGS_UPDATED) {
				const payload = msg.data as SettingsUpdatedPayload | undefined;
				if (payload?.key === SETTING_KEYS.DELIVERY_TARGET_MINUTES) {
					void hydrateSettings();
					startTransition(() => setInternalStatsTrigger((n) => n + 1));
				}
			}
		},
		[applyWsEvent, hydrateSettings, setMusicStatus],
	);

	const onConnect = useCallback(() => setConnected(true), [setConnected]);
	const onDisconnect = useCallback(() => setConnected(false), [setConnected]);

	useWebSocket({ channel: WS_CHANNELS.ORDERS, onMessage, onConnect, onDisconnect });

	useEffect(() => {
		let cancelled = false;

		const hydrateInitialState = async () => {
			await Promise.allSettled([hydrate(), hydrateSettings()]);
			if (!cancelled) {
				setInitialHydrationReady(true);
			}
		};

		void hydrateInitialState();

		return () => {
			cancelled = true;
		};
	}, [hydrate, hydrateSettings]);

	useBootScreenReady(initialHydrationReady);

	useEffect(() => {
		if (!activeTab) return;
		setMountedTabs((current) => (current.includes(activeTab) ? current : [...current, activeTab]));
	}, [activeTab]);

	useEffect(() => {
		if (!initialHydrationReady) return;

		const preloadTimerId = window.setTimeout(() => {
			setMountedTabs((current) => {
				const next = [...current];
				for (const tab of ADMIN_TABS) {
					const tabId = tab.to.split("/").at(-1);
					if (tabId && !next.includes(tabId)) {
						next.push(tabId);
					}
				}
				return next;
			});
		}, 220);

		return () => {
			window.clearTimeout(preloadTimerId);
		};
	}, [initialHydrationReady]);

	if (location.pathname === "/admin" || location.pathname === "/admin/") {
		return <Navigate to="/admin/orders" replace />;
	}

	if (!activeTab) {
		return <Navigate to="/admin/orders" replace />;
	}

	return (
		<AppShell header={<AdminHeader />}>
			<div className="min-h-[calc(100vh-13rem)]">
				{mountedTabs.includes("orders") ? (
					<section hidden={activeTab !== "orders"} aria-hidden={activeTab !== "orders"}>
						<OrdersTab />
					</section>
				) : null}

				{mountedTabs.includes("stats") ? (
					<section hidden={activeTab !== "stats"} aria-hidden={activeTab !== "stats"}>
						<StatsTab wsTrigger={internalStatsTrigger} reconnectedAt={lastReconnectedAt} />
					</section>
				) : null}

				{mountedTabs.includes("audio") ? (
					<section hidden={activeTab !== "audio"} aria-hidden={activeTab !== "audio"}>
						<AudioTab />
					</section>
				) : null}

				{mountedTabs.includes("display") ? (
					<section hidden={activeTab !== "display"} aria-hidden={activeTab !== "display"}>
						<DisplayTab />
					</section>
				) : null}

				{mountedTabs.includes("notes") ? (
					<section hidden={activeTab !== "notes"} aria-hidden={activeTab !== "notes"}>
						<NotePresetsTab />
					</section>
				) : null}
			</div>
		</AppShell>
	);
}
