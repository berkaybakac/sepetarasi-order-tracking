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
		<div className="flex flex-col h-screen bg-slate-950 overflow-hidden">
			{/* Header */}
			<header className="flex-shrink-0 bg-slate-900/90 backdrop-blur-sm border-b border-white/[0.06] px-5 py-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2.5">
						<BasketIcon size={22} className="text-emerald-500" strokeWidth={2.5} />
						<h1 className="text-lg font-bold tracking-wide text-white">
							SEPET ARASI <span className="text-slate-400 font-semibold">KASA</span>
						</h1>
					</div>
					<div className="flex items-center gap-2">
						{stats && (
							<>
								<span className="bg-slate-800 text-slate-300 text-sm px-3 py-1 rounded-full">
									{stats.totalOrders} sipariş
								</span>
								{stats.averagePrepMinutes != null && (
									<span className="bg-slate-800 text-slate-300 text-sm px-3 py-1 rounded-full">
										ort. {stats.averagePrepMinutes} dk
									</span>
								)}
							</>
						)}
						<button
							type="button"
							onClick={onReconfigure}
							className="flex items-center gap-1.5 ml-1 px-3 py-1 rounded-full bg-slate-800 cursor-pointer hover:bg-slate-700 transition-colors"
							title={
								connected ? "Bağlı — ayarları değiştir" : "Bağlantı kesildi — ayarları değiştir"
							}
						>
							<span
								className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? "bg-emerald-500" : "bg-red-500 animate-pulse"}`}
							/>
							<span className={`text-sm ${connected ? "text-emerald-400" : "text-red-400"}`}>
								{connected ? "Bağlı" : "Bağlantı kesildi"}
							</span>
						</button>
					</div>
				</div>
			</header>

			{/* Body */}
			<div className="flex flex-1 overflow-hidden">
				{/* Main */}
				<main className="flex-1 overflow-y-auto">
					{loading ? (
						<div className="flex items-center justify-center py-24">
							<div className="w-8 h-8 border-2 border-slate-700 border-t-slate-400 rounded-full animate-spin" />
						</div>
					) : (
						<OrderList />
					)}
				</main>

				{/* Sidebar — right side for right-handed cashiers */}
				<aside className="w-80 flex-shrink-0 bg-slate-900/80 border-l border-white/[0.06] overflow-y-auto">
					<OrderForm />
				</aside>
			</div>
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
				printerCodePage: 61,
				printerEncoding: "cp857",
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
			<div className="min-h-screen flex items-center justify-center bg-slate-950">
				<div className="text-center">
					<div className="inline-block w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-4" />
					<p className="text-white text-lg font-medium">Sunucu aranıyor...</p>
					<p className="text-slate-400 text-sm mt-1">Ağ taranıyor, lütfen bekleyin</p>
				</div>
			</div>
		);
	}

	if (!configured) {
		return <ServerConfig onConnected={() => setConfigured(true)} />;
	}

	return <KasaApp onReconfigure={() => setConfigured(false)} />;
}
