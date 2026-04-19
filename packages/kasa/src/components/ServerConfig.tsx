import { useEffect, useRef, useState } from "react";
import {
	ApiError,
	getBaseUrl,
	setCashierToken as setApiCashierToken,
	setTerminalId as setApiTerminalId,
	setBaseUrl,
	verifyCashierToken,
} from "../lib/api";
import {
	getEffectiveCashierToken,
	getSavedCashierTokenForServerUrl,
	isLocalDevServerUrl,
	normalizeCashierTokensByServerUrl,
	normalizeServerUrl,
	upsertCashierTokenForServerUrl,
} from "../lib/connection-config";
import { type KasaConfig, getElectronAPI, reportRendererError } from "../lib/electron";
import { getUserErrorMessage } from "../lib/user-error";

interface ServerConfigProps {
	onConnected: () => void;
}

const inputClass =
	"w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-400 rounded-lg px-4 py-2.5 text-[15px] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors";

const labelClass = "block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1";

function isUnauthorizedError(error: unknown) {
	return error instanceof ApiError && error.code === "UNAUTHORIZED";
}

export function ServerConfig({ onConnected }: ServerConfigProps) {
	const [url, setUrl] = useState(getBaseUrl());
	const [terminalId, setTerminalId] = useState("KASA-1");
	const [terminalName, setTerminalName] = useState("Kasa 1");
	const [printerIp, setPrinterIp] = useState("");
	const [printerCodePage, setPrinterCodePage] = useState("61");
	const [printerEncoding, setPrinterEncoding] = useState("cp857");
	const [cashierTokensByServerUrl, setCashierTokensByServerUrl] = useState<Record<string, string>>(
		{},
	);
	const [cashierTokenDraft, setCashierTokenDraft] = useState("");
	const [tokenEditorOpen, setTokenEditorOpen] = useState(false);
	const [testing, setTesting] = useState(false);
	const [discovering, setDiscovering] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [discoverHint, setDiscoverHint] = useState<string | null>(null);

	const normalizedUrl = normalizeServerUrl(url);
	const isLocalDev = isLocalDevServerUrl(normalizedUrl);
	const previousNormalizedUrlRef = useRef(normalizedUrl);
	const savedCashierToken = getSavedCashierTokenForServerUrl(
		normalizedUrl,
		cashierTokensByServerUrl,
	);
	const hasSavedCashierToken = savedCashierToken.trim().length > 0;
	const hasCashierTokenDraft = cashierTokenDraft.trim().length > 0;

	useEffect(() => {
		async function load() {
			const electronAPI = getElectronAPI();
			if (!electronAPI) return;

			const config = await electronAPI.getConfig();
			setUrl(normalizeServerUrl(config.serverUrl));
			setTerminalId(config.terminalId);
			setTerminalName(config.terminalName);
			setPrinterIp(config.printerIp);
			setPrinterCodePage(String(config.printerCodePage));
			setPrinterEncoding(config.printerEncoding);
			setCashierTokensByServerUrl(
				upsertCashierTokenForServerUrl(
					normalizeCashierTokensByServerUrl(config.cashierTokensByServerUrl),
					config.serverUrl,
					config.cashierToken,
				),
			);
			setCashierTokenDraft("");
		}

		void load();
	}, []);

	useEffect(() => {
		const previousNormalizedUrl = previousNormalizedUrlRef.current;

		if (previousNormalizedUrl !== normalizedUrl && tokenEditorOpen) {
			setCashierTokenDraft("");
		}
		if (isLocalDev && tokenEditorOpen) {
			setTokenEditorOpen(false);
			setCashierTokenDraft("");
		}
		previousNormalizedUrlRef.current = normalizedUrl;
	}, [isLocalDev, normalizedUrl, tokenEditorOpen]);

	const effectiveCashierToken = getEffectiveCashierToken(
		normalizedUrl,
		hasCashierTokenDraft ? cashierTokenDraft : savedCashierToken,
	);

	const handleDiscover = async () => {
		const electronAPI = getElectronAPI();
		if (!electronAPI) return;
		setDiscovering(true);
		setDiscoverHint(null);
		setError(null);
		try {
			const found = await electronAPI.discoverServer();
			if (found) {
				setUrl(normalizeServerUrl(found));
			} else {
				setDiscoverHint("Sunucu otomatik bulunamadı. Adresi elle girebilirsiniz.");
			}
		} catch (error) {
			reportRendererError({
				component: "config",
				event: "config.discovery_failed",
				message: "Kasa server discovery failed",
				error,
			});
			setDiscoverHint("Sunucu aranırken sorun oluştu. Adresi elle girebilirsiniz.");
		} finally {
			setDiscovering(false);
		}
	};

	const handleTest = async () => {
		setTesting(true);
		setError(null);

		if (!normalizedUrl) {
			setError("Sunucu adresi gereklidir.");
			setTesting(false);
			return;
		}

		const parsedCodePage = Number.parseInt(printerCodePage, 10);
		if (Number.isNaN(parsedCodePage) || parsedCodePage < 0 || parsedCodePage > 255) {
			setError("Kod sayfası 0 ile 255 arasında olmalıdır.");
			setTesting(false);
			return;
		}

		if (!effectiveCashierToken) {
			setError("Kasiyer token gereklidir.");
			setTesting(false);
			return;
		}

		let validationStep: "health" | "cashier_token" = "health";

		try {
			const res = await fetch(`${normalizedUrl}/health`);
			const data = (await res.json()) as { ok?: boolean };
			if (!data.ok) {
				setError("Sunucuya erişildi ama bağlantı tamamlanamadı.");
				return;
			}

			validationStep = "cashier_token";
			await verifyCashierToken(normalizedUrl, effectiveCashierToken);

			setBaseUrl(normalizedUrl);
			setApiTerminalId(terminalId);
			setApiCashierToken(effectiveCashierToken);
			const updatedCashierTokensByServerUrl = upsertCashierTokenForServerUrl(
				cashierTokensByServerUrl,
				normalizedUrl,
				effectiveCashierToken,
			);

			const config: KasaConfig = {
				serverUrl: normalizedUrl,
				terminalId,
				terminalName,
				hotkey: "Ctrl+Shift+O",
				printerIp,
				printerCodePage: parsedCodePage,
				printerEncoding: printerEncoding.trim().toLowerCase() || "cp857",
				cashierToken: effectiveCashierToken,
				cashierTokensByServerUrl: updatedCashierTokensByServerUrl,
			};
			await getElectronAPI()?.saveConfig(config);
			setCashierTokensByServerUrl(updatedCashierTokensByServerUrl);
			onConnected();
		} catch (error) {
			reportRendererError({
				component: "config",
				event: "config.connection_test_failed",
				message: "Kasa server connection test failed",
				error,
				context: {
					serverUrl: normalizedUrl,
					terminalId,
					validationStep,
				},
			});
			if (validationStep === "cashier_token" && isUnauthorizedError(error)) {
				setError("Kasiyer token doğrulanamadı. Token'ı kontrol edin.");
			} else {
				setError(getUserErrorMessage(error, "Sunucuya bağlanılamadı. Adresi kontrol edin."));
			}
		} finally {
			setTesting(false);
		}
	};

	const handleTokenEditorToggle = () => {
		setError(null);
		if (tokenEditorOpen) {
			setTokenEditorOpen(false);
			setCashierTokenDraft("");
			return;
		}
		setTokenEditorOpen(true);
	};

	return (
		<div className="min-h-screen flex items-center justify-center p-4">
			<div className="bg-slate-900/80 border border-white/[0.07] rounded-2xl p-6 sm:p-7 max-w-lg w-full shadow-2xl shadow-black/40">
				<h1 className="text-[2rem] font-bold text-white mb-1 tracking-wide">SEPET ARASI KASA</h1>
				<p className="text-slate-400 mb-5">Kasa ayarlarını yapılandırın</p>

				<div className="mb-3">
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
						onKeyDown={(e) => e.key === "Enter" && void handleTest()}
					/>
				</div>

				<div className="grid grid-cols-2 gap-3 mb-3">
					<div>
						<label htmlFor="terminal-id" className={labelClass}>
							Terminal Kodu
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

				<div className="mb-4">
					<label htmlFor="printer-ip" className={labelClass}>
						Yazıcı IP Adresi
					</label>
					<input
						id="printer-ip"
						type="text"
						value={printerIp}
						onChange={(e) => setPrinterIp(e.target.value)}
						placeholder="192.168.1.12"
						className={inputClass}
					/>
					<p className="text-xs text-slate-500 mt-1.5">Boşsa fiş yazdırılmaz</p>
				</div>

				<div className="grid grid-cols-2 gap-3 mb-4">
					<div>
						<label htmlFor="printer-code-page" className={labelClass}>
							Kod Sayfası
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
							Karakter Kodlaması
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
				<p className="text-[11px] leading-5 text-slate-500 -mt-2.5 mb-4">
					Önerilen ayar: <code>61</code> ve <code>cp857</code>. Türkçe bozulursa <code>24</code> ve{" "}
					<code>cp1254</code> deneyin.
				</p>

				{!isLocalDev ? (
					<div className="mb-4 rounded-xl border border-white/[0.07] bg-slate-800/40 px-4 py-3">
						<div className="flex items-center justify-between gap-3">
							<div>
								<p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
									Gelişmiş
								</p>
								<p className="mt-1 text-sm text-slate-200">
									Kasiyer token: {hasSavedCashierToken ? "kayıtlı" : "gerekli"}
								</p>
							</div>
							<button
								type="button"
								onClick={handleTokenEditorToggle}
								className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-slate-400 hover:text-white"
							>
								{tokenEditorOpen ? "Token Alanını Kapat" : "Token Değiştir"}
							</button>
						</div>

						{tokenEditorOpen ? (
							<div className="mt-4">
								<label htmlFor="cashier-token" className={labelClass}>
									Kasiyer Token
								</label>
								<input
									id="cashier-token"
									type="password"
									value={cashierTokenDraft}
									onChange={(e) => setCashierTokenDraft(e.target.value)}
									placeholder={
										hasSavedCashierToken
											? "Boş bırakırsan mevcut token korunur"
											: "Yeni kasiyer token'ı"
									}
									className={`${inputClass} font-mono text-sm`}
									autoComplete="off"
									spellCheck={false}
								/>
								<p className="mt-2 text-xs text-slate-500">
									{hasSavedCashierToken
										? "Alanı boş bırakırsan mevcut doğrulanmış token korunur."
										: "Bağlanmadan önce yeni kasiyer token'ını gir."}
								</p>
							</div>
						) : null}
					</div>
				) : null}

				<div className="bg-slate-800/60 border border-white/[0.05] rounded-lg px-3 py-2 mb-4 text-sm text-slate-400">
					Kısayol:{" "}
					<kbd className="bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded text-xs font-mono">
						Ctrl+Shift+O
					</kbd>{" "}
					- Pencereyi aç/kapat
				</div>

				{error ? (
					<p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3">
						{error}
					</p>
				) : null}

				<div className="flex gap-3">
					<button
						type="button"
						onClick={handleDiscover}
						disabled={testing || discovering || !getElectronAPI()}
						className="flex-1 border border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white hover:bg-slate-700/50 font-bold py-2.5 rounded-xl text-base disabled:opacity-40 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
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
						className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold py-2.5 rounded-xl text-base disabled:opacity-50 transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(16,185,129,0.25)]"
					>
						{testing ? "Bağlanıyor..." : "Bağlan"}
					</button>
				</div>

				{discoverHint ? (
					<p className="text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mt-3">
						{discoverHint}
					</p>
				) : null}
			</div>
		</div>
	);
}
