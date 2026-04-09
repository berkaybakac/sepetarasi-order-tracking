import { BasketIcon, WS_CHANNELS, type WsMessage } from "@sepetarasi/shared";
import { useCallback, useEffect, useState } from "react";
import { OrderForm } from "./components/OrderForm";
import { OrderList } from "./components/OrderList";
import { ServerConfig } from "./components/ServerConfig";
import { useWebSocket } from "./hooks/useWebSocket";
import { setBaseUrl, setTerminalId } from "./lib/api";
import { useOrderStore } from "./stores/orderStore";

function KasaApp() {
	const hydrate = useOrderStore((s) => s.hydrate);
	const applyWsEvent = useOrderStore((s) => s.applyWsEvent);
	const setConnected = useOrderStore((s) => s.setConnected);
	const connected = useOrderStore((s) => s.connected);
	const stats = useOrderStore((s) => s.stats);
	const loading = useOrderStore((s) => s.loading);

	const onMessage = useCallback((msg: WsMessage) => applyWsEvent(msg), [applyWsEvent]);

	const onConnect = useCallback(() => {
		setConnected(true);
	}, [setConnected]);

	const onDisconnect = useCallback(() => {
		setConnected(false);
	}, [setConnected]);

	useWebSocket({
		channel: WS_CHANNELS.ORDERS,
		onMessage,
		onConnect,
		onDisconnect,
	});

	useEffect(() => {
		hydrate();
	}, [hydrate]);

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Header */}
			<header className="bg-white shadow-sm border-b px-4 py-3">
				<div className="flex items-center justify-between max-w-5xl mx-auto">
					<div className="flex items-center gap-2">
						<BasketIcon size={24} className="text-brand-primary" strokeWidth={2.5} />
						<h1 className="text-xl font-bold text-gray-800">Sepetarasi Kasa</h1>
					</div>
					<div className="flex items-center gap-4 text-sm">
						{stats && (
							<span className="text-gray-500">
								Bugün: {stats.totalOrders} sipariş
								{stats.averagePrepMinutes != null && <> | Ort: {stats.averagePrepMinutes} dk</>}
							</span>
						)}
						<span
							className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
							title={connected ? "Bağlı" : "Bağlantı kesildi"}
						/>
					</div>
				</div>
			</header>

			{/* Main */}
			<main className="max-w-[1320px] mx-auto p-4 grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-4 items-start">
				<div>
					<OrderForm />
				</div>
				<div className="min-w-0">
					{loading ? (
						<div className="text-center text-gray-400 py-12">Yükleniyor...</div>
					) : (
						<OrderList />
					)}
				</div>
			</main>
		</div>
	);
}

export default function App() {
	const [configured, setConfigured] = useState(false);

	useEffect(() => {
		async function loadConfig() {
			if (window.electronAPI) {
				const config = await window.electronAPI.getConfig();
				setBaseUrl(config.serverUrl);
				setTerminalId(config.terminalId);
			}
			// Auto-test connection
			try {
				const serverUrl = window.electronAPI
					? (await window.electronAPI.getConfig()).serverUrl
					: "http://localhost:3000";
				const res = await fetch(`${serverUrl.replace(/\/$/, "")}/health`);
				const data = await res.json();
				if (data.ok) {
					if (!window.electronAPI) {
						setBaseUrl("http://localhost:3000");
					}
					setConfigured(true);
				}
			} catch {
				// Need manual config
			}
		}
		loadConfig();
	}, []);

	if (!configured) {
		return <ServerConfig onConnected={() => setConfigured(true)} />;
	}

	return <KasaApp />;
}
