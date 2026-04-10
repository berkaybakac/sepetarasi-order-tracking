import { WS_CHANNELS, type WsMessage } from "@sepetarasi/shared";
import { useCallback, useEffect, useState } from "react";
import { BasketIcon } from "./components/BasketIcon";
import { OrderForm } from "./components/OrderForm";
import { OrderList } from "./components/OrderList";
import { ServerConfig } from "./components/ServerConfig";
import { useWebSocket } from "./hooks/useWebSocket";
import { setBaseUrl, setCashierToken, setTerminalId } from "./lib/api";
import { useOrderStore } from "./stores/orderStore";

function KasaApp({ onReconfigure }: { onReconfigure: () => void }) {
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
						<button
							type="button"
							onClick={onReconfigure}
							className={`w-3 h-3 rounded-full cursor-pointer hover:opacity-70 transition-opacity ${connected ? "bg-green-500" : "bg-red-500 animate-pulse"}`}
							title={
								connected ? "Bağlı — ayarları değiştir" : "Bağlantı kesildi — ayarları değiştir"
							}
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
	const [discovering, setDiscovering] = useState(false);

	useEffect(() => {
		async function init() {
			let serverUrl = "http://localhost:3000";
			let config = {
				serverUrl,
				terminalId: "",
				terminalName: "",
				hotkey: "",
				printerIp: "",
				cashierToken: "",
			};

			if (window.electronAPI) {
				config = await window.electronAPI.getConfig();
				serverUrl = config.serverUrl;
				setBaseUrl(serverUrl);
				setTerminalId(config.terminalId);
				setCashierToken(config.cashierToken);
			}

			// Step 1: try saved/default URL
			const primaryOk = await (async () => {
				try {
					const res = await fetch(`${serverUrl.replace(/\/$/, "")}/health`);
					const data = (await res.json()) as { ok?: boolean };
					return data.ok === true;
				} catch {
					return false;
				}
			})();

			if (primaryOk) {
				if (!window.electronAPI) setBaseUrl("http://localhost:3000");
				setConfigured(true);
				return;
			}

			// Step 2: auto-discovery (Electron only)
			if (!window.electronAPI) return;

			setDiscovering(true);
			try {
				const discovered = await window.electronAPI.discoverServer();
				if (discovered) {
					setBaseUrl(discovered);
					await window.electronAPI.saveConfig({ ...config, serverUrl: discovered });
					setConfigured(true);
					return;
				}
			} catch {
				// Discovery failed — fall through to manual config
			} finally {
				setDiscovering(false);
			}
		}
		init();
	}, []);

	if (discovering) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="text-center">
					<div className="inline-block w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
					<p className="text-gray-600 text-lg font-medium">Sunucu aranıyor...</p>
					<p className="text-gray-400 text-sm mt-1">Ağ taranıyor, lütfen bekleyin</p>
				</div>
			</div>
		);
	}

	if (!configured) {
		return <ServerConfig onConnected={() => setConfigured(true)} />;
	}

	return <KasaApp onReconfigure={() => setConfigured(false)} />;
}
