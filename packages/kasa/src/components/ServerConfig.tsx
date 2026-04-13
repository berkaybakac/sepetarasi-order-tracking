import type { Order } from "@sepetarasi/shared";
import { useEffect, useState } from "react";
import {
	getBaseUrl,
	setCashierToken as setApiCashierToken,
	setTerminalId as setApiTerminalId,
	setBaseUrl,
} from "../lib/api";

interface KasaConfig {
	serverUrl: string;
	terminalId: string;
	terminalName: string;
	hotkey: string;
	printerIp: string;
	printerCodePage: number;
	printerEncoding: string;
	cashierToken: string;
}

interface PrintReceiptResult {
	ok: boolean;
	error?: string;
}

declare global {
	interface Window {
		electronAPI?: {
			getConfig: () => Promise<KasaConfig>;
			saveConfig: (config: KasaConfig) => Promise<boolean>;
			discoverServer: () => Promise<string | null>;
			printReceipt: (order: Order) => Promise<PrintReceiptResult>;
		};
	}
}

interface ServerConfigProps {
	onConnected: () => void;
}

const inputClass =
	"w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-400 rounded-lg px-4 py-3 text-base focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors";

const labelClass = "block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5";

export function ServerConfig({ onConnected }: ServerConfigProps) {
	const [url, setUrl] = useState(getBaseUrl());
	const [terminalId, setTerminalId] = useState("KASA-1");
	const [terminalName, setTerminalName] = useState("Kasa 1");
	const [printerIp, setPrinterIp] = useState("");
	const [printerCodePage, setPrinterCodePage] = useState("61");
	const [printerEncoding, setPrinterEncoding] = useState("cp857");
	const [cashierToken, setCashierToken] = useState("");
	const [showCashierToken, setShowCashierToken] = useState(false);
	const [testing, setTesting] = useState(false);
	const [discovering, setDiscovering] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [discoverHint, setDiscoverHint] = useState<string | null>(null);

	useEffect(() => {
		async function load() {
			if (window.electronAPI) {
				const config = await window.electronAPI.getConfig();
				setUrl(config.serverUrl);
				setTerminalId(config.terminalId);
				setTerminalName(config.terminalName);
				setPrinterIp(config.printerIp);
				setPrinterCodePage(String(config.printerCodePage));
				setPrinterEncoding(config.printerEncoding);
				setCashierToken(config.cashierToken);
			}
		}
		load();
	}, []);

	const handleDiscover = async () => {
		if (!window.electronAPI) return;
		setDiscovering(true);
		setDiscoverHint(null);
		setError(null);
		try {
			const found = await window.electronAPI.discoverServer();
			if (found) {
				setUrl(found);
			} else {
				const isWindows = navigator.platform.toLowerCase().includes("win");
				setDiscoverHint(
					isWindows
						? "Sunucu bulunamadı. Windows'ta .local adresleri için Apple Bonjour gereklidir — iTunes ile gelir veya Apple'dan ayrıca kurulabilir."
						: "Sunucu bulunamadı. Cihazın aynı ağda olduğundan emin olun.",
				);
			}
		} catch {
			setDiscoverHint("Arama sırasında hata oluştu.");
		} finally {
			setDiscovering(false);
		}
	};

	const handleTest = async () => {
		setTesting(true);
		setError(null);

		const parsedCodePage = Number.parseInt(printerCodePage, 10);
		if (Number.isNaN(parsedCodePage) || parsedCodePage < 0 || parsedCodePage > 255) {
			setError("Yazıcı Code Page değeri 0 ile 255 arasında olmalı");
			setTesting(false);
			return;
		}

		try {
			const res = await fetch(`${url.replace(/\/$/, "")}/health`);
			const data = await res.json();
			if (data.ok) {
				setBaseUrl(url);
				setApiTerminalId(terminalId);
				setApiCashierToken(cashierToken);
				const config: KasaConfig = {
					serverUrl: url,
					terminalId,
					terminalName,
					hotkey: "Ctrl+Shift+O",
					printerIp,
					printerCodePage: parsedCodePage,
					printerEncoding: printerEncoding.trim().toLowerCase() || "cp857",
					cashierToken,
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
		<div className="min-h-screen flex items-center justify-center">
			<div className="bg-slate-900/80 border border-white/[0.07] rounded-2xl p-8 max-w-md w-full shadow-2xl shadow-black/40">
				<h1 className="text-2xl font-bold text-white mb-1 tracking-wide">SEPET ARASI KASA</h1>
				<p className="text-slate-400 mb-7">Kasa ayarlarını yapılandırın</p>

				{/* Sunucu Adresi */}
				<div className="mb-4">
					<label htmlFor="server-url" className={labelClass}>
						Sunucu Adresi
					</label>
					<input
						id="server-url"
						type="text"
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						placeholder="http://sepetarasi.local:3000"
						className={inputClass}
						onKeyDown={(e) => e.key === "Enter" && handleTest()}
					/>
				</div>

				{/* Terminal ID + Adı */}
				<div className="grid grid-cols-2 gap-3 mb-4">
					<div>
						<label htmlFor="terminal-id" className={labelClass}>
							Terminal ID
						</label>
						<input
							id="terminal-id"
							type="text"
							value={terminalId}
							onChange={(e) => setTerminalId(e.target.value)}
							placeholder="KASA-1"
							className={inputClass}
						/>
					</div>
					<div>
						<label htmlFor="terminal-name" className={labelClass}>
							Terminal Adı
						</label>
						<input
							id="terminal-name"
							type="text"
							value={terminalName}
							onChange={(e) => setTerminalName(e.target.value)}
							placeholder="Kasa 1"
							className={inputClass}
						/>
					</div>
				</div>

				{/* Kasiyer Token */}
				<div className="mb-4">
					<label htmlFor="cashier-token" className={labelClass}>
						Kasiyer Token
					</label>
					<div className="relative">
						<input
							id="cashier-token"
							type={showCashierToken ? "text" : "password"}
							value={cashierToken}
							onChange={(e) => setCashierToken(e.target.value)}
							placeholder="local-dev-cashier-token"
							className={`${inputClass} pr-24 font-mono text-sm`}
							autoComplete="off"
							spellCheck={false}
						/>
						<button
							type="button"
							onClick={() => setShowCashierToken((prev) => !prev)}
							className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-400 transition-colors"
						>
							{showCashierToken ? "Gizle" : "Göster"}
						</button>
					</div>
				</div>

				{/* Yazıcı IP */}
				<div className="mb-5">
					<label htmlFor="printer-ip" className={labelClass}>
						Yazıcı IP Adresi{" "}
						<span className="text-slate-500 normal-case font-normal">(opsiyonel)</span>
					</label>
					<input
						id="printer-ip"
						type="text"
						value={printerIp}
						onChange={(e) => setPrinterIp(e.target.value)}
						placeholder="192.168.1.12"
						className={inputClass}
					/>
					<p className="text-xs text-slate-500 mt-1.5">
						Boş bırakılırsa fiş yazdırma devre dışı kalır
					</p>
				</div>

				<div className="grid grid-cols-2 gap-3 mb-5">
					<div>
						<label htmlFor="printer-code-page" className={labelClass}>
							Code Page
						</label>
						<input
							id="printer-code-page"
							type="number"
							min={0}
							max={255}
							value={printerCodePage}
							onChange={(e) => setPrinterCodePage(e.target.value)}
							placeholder="61"
							className={inputClass}
						/>
					</div>
					<div>
						<label htmlFor="printer-encoding" className={labelClass}>
							Encoding
						</label>
						<input
							id="printer-encoding"
							type="text"
							value={printerEncoding}
							onChange={(e) => setPrinterEncoding(e.target.value)}
							placeholder="cp857"
							className={`${inputClass} font-mono text-sm`}
						/>
					</div>
				</div>
				<p className="text-xs text-slate-500 -mt-3 mb-5">
					Varsayılan: <code>cp857</code> + <code>61</code>. Türkçe karakter bozuksa alternatif
					olarak <code>cp1254</code> + <code>24</code> deneyin.
				</p>

				{/* Kısayol bilgisi */}
				<div className="bg-slate-800/60 border border-white/[0.05] rounded-lg px-3 py-2 mb-5 text-sm text-slate-400">
					Kısayol:{" "}
					<kbd className="bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded text-xs font-mono">
						Ctrl+Shift+O
					</kbd>{" "}
					— Pencereyi göster/gizle
				</div>

				{error && (
					<p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">
						{error}
					</p>
				)}

				<div className="flex gap-3">
					<button
						type="button"
						onClick={handleDiscover}
						disabled={testing || discovering || !window.electronAPI}
						className="flex-1 border border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white hover:bg-slate-700/50 font-bold py-3 rounded-xl text-base disabled:opacity-40 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
					>
						{discovering ? (
							<>
								<span className="inline-block w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
								Aranıyor...
							</>
						) : (
							"Otomatik Ara"
						)}
					</button>
					<button
						type="button"
						onClick={handleTest}
						disabled={testing || discovering}
						className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold py-3 rounded-xl text-base disabled:opacity-50 transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(16,185,129,0.25)]"
					>
						{testing ? "Bağlanıyor..." : "Bağlan"}
					</button>
				</div>

				{discoverHint && (
					<p className="text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mt-4">
						{discoverHint}
					</p>
				)}
			</div>
		</div>
	);
}
