import { useEffect, useState } from "react";
import { getBaseUrl, setTerminalId as setApiTerminalId, setBaseUrl } from "../lib/api";

interface KasaConfig {
	serverUrl: string;
	terminalId: string;
	terminalName: string;
	hotkey: string;
	printerName: string;
}

declare global {
	interface Window {
		electronAPI?: {
			getConfig: () => Promise<KasaConfig>;
			saveConfig: (config: KasaConfig) => Promise<boolean>;
		};
	}
}

interface ServerConfigProps {
	onConnected: () => void;
}

export function ServerConfig({ onConnected }: ServerConfigProps) {
	const [url, setUrl] = useState(getBaseUrl());
	const [terminalId, setTerminalId] = useState("KASA-1");
	const [terminalName, setTerminalName] = useState("Kasa 1");
	const [printerName, setPrinterName] = useState("");
	const [testing, setTesting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		async function load() {
			if (window.electronAPI) {
				const config = await window.electronAPI.getConfig();
				setUrl(config.serverUrl);
				setTerminalId(config.terminalId);
				setTerminalName(config.terminalName);
				setPrinterName(config.printerName);
			}
		}
		load();
	}, []);

	const handleTest = async () => {
		setTesting(true);
		setError(null);

		try {
			const res = await fetch(`${url.replace(/\/$/, "")}/health`);
			const data = await res.json();
			if (data.ok) {
				setBaseUrl(url);
				setApiTerminalId(terminalId);
				const config: KasaConfig = {
					serverUrl: url,
					terminalId,
					terminalName,
					hotkey: "Ctrl+Shift+O",
					printerName,
				};
				await window.electronAPI?.saveConfig(config);
				onConnected();
			} else {
				setError("Sunucu yanıt verdi ama sağlık kontrolü başarısız");
			}
		} catch (err) {
			// Dev note: .local hostnames require Bonjour on Windows (comes with iTunes or install separately from Apple)
			console.error("Kasa connection failed:", err);
			setError("Sunucuya bağlanılamadı. Adresi ve ağ bağlantısını kontrol edin.");
		} finally {
			setTesting(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50">
			<div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
				<h1 className="text-2xl font-bold mb-2">Sepetarası Kasa</h1>
				<p className="text-gray-500 mb-6">Kasa ayarlarını yapılandırın</p>

				<label htmlFor="server-url" className="block text-sm font-medium text-gray-700 mb-1">
					Sunucu Adresi
				</label>
				<input
					id="server-url"
					type="text"
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					placeholder="http://sepetarasi.local:3000"
					className="w-full border rounded-lg px-4 py-3 text-lg mb-3"
					onKeyDown={(e) => e.key === "Enter" && handleTest()}
				/>

				<div className="grid grid-cols-2 gap-3 mb-3">
					<div>
						<label htmlFor="terminal-id" className="block text-sm font-medium text-gray-700 mb-1">
							Terminal ID
						</label>
						<input
							id="terminal-id"
							type="text"
							value={terminalId}
							onChange={(e) => setTerminalId(e.target.value)}
							placeholder="KASA-1"
							className="w-full border rounded-lg px-3 py-2"
						/>
					</div>
					<div>
						<label htmlFor="terminal-name" className="block text-sm font-medium text-gray-700 mb-1">
							Terminal Adı
						</label>
						<input
							id="terminal-name"
							type="text"
							value={terminalName}
							onChange={(e) => setTerminalName(e.target.value)}
							placeholder="Kasa 1"
							className="w-full border rounded-lg px-3 py-2"
						/>
					</div>
				</div>

				<label htmlFor="printer-name" className="block text-sm font-medium text-gray-700 mb-1">
					Yazıcı Adı
				</label>
				<input
					id="printer-name"
					type="text"
					value={printerName}
					onChange={(e) => setPrinterName(e.target.value)}
					placeholder="Boş bırakılabilir"
					className="w-full border rounded-lg px-3 py-2 mb-3"
				/>

				<div className="bg-gray-50 rounded-lg px-3 py-2 mb-4 text-sm text-gray-500">
					Kısayol:{" "}
					<kbd className="bg-gray-200 px-1.5 py-0.5 rounded text-xs font-mono">Ctrl+Shift+O</kbd> —
					Pencereyi göster/gizle
				</div>

				{error && <p className="text-red-500 text-sm mb-3">{error}</p>}

				<button
					type="button"
					onClick={handleTest}
					disabled={testing}
					className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg text-lg
						disabled:opacity-50 transition-colors"
				>
					{testing ? "Bağlanıyor..." : "Bağlan"}
				</button>
			</div>
		</div>
	);
}
