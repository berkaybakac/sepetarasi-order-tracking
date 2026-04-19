import {
	SETTING_KEYS,
	type SettingsUpdatedPayload,
	WS_CHANNELS,
	WS_EVENTS,
	type WsMessage,
} from "@sepetarasi/shared";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { BrandLogo } from "./components/BrandLogo";
import { OrderForm } from "./components/OrderForm";
import { OrderList } from "./components/OrderList";
import { ServerConfig } from "./components/ServerConfig";
import { useWebSocket } from "./hooks/useWebSocket";
import { ApiError, api, setBaseUrl, setCashierToken, setTerminalId } from "./lib/api";
import { useOrderStore } from "./stores/orderStore";
import { useSettingsStore } from "./stores/settingsStore";

function getUnlockErrorMessage(error: unknown): string {
	if (error instanceof ApiError && error.code === "UNAUTHORIZED") {
		return "Yönetici şifresi hatalı.";
	}
	if (error instanceof Error && error.message) {
		return error.message;
	}
	return "Şifre doğrulanamadı. Bağlantıyı kontrol edip tekrar deneyin.";
}

interface AdminUnlockModalProps {
	error: string | null;
	isOpen: boolean;
	isSubmitting: boolean;
	onClose: () => void;
	onPasswordChange: (value: string) => void;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
	password: string;
}

function AdminUnlockModal({
	error,
	isOpen,
	isSubmitting,
	onClose,
	onPasswordChange,
	onSubmit,
	password,
}: AdminUnlockModalProps) {
	const [showPassword, setShowPassword] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const focusPasswordInput = () => {
		if (isSubmitting) return;
		const input = inputRef.current;
		if (!input) return;
		input.focus();
		const cursorPosition = input.value.length;
		try {
			input.setSelectionRange(cursorPosition, cursorPosition);
		} catch {}
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
			<div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-slate-900 shadow-2xl shadow-black/50">
				<div className="border-b border-white/[0.06] px-6 py-5">
					<h2 className="text-xl font-bold text-white tracking-wide">Yönetici Şifresi</h2>
					<p className="mt-1 text-sm text-slate-400">
						Ayarları değiştirmek için yönetici parolasını girin.
					</p>
				</div>

				<form onSubmit={onSubmit} className="space-y-4 px-6 py-5">
					<div>
						<label
							htmlFor="admin-unlock-password"
							className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400"
						>
							Parola
						</label>
						{/* biome-ignore lint/a11y/useKeyWithClickEvents: input is focusable via label htmlFor; wrapper click is an edge-padding convenience only. */}
						<div
							className="flex h-[50px] items-center rounded-lg border border-slate-700 bg-slate-800 transition focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500"
							onClick={(event) => {
								if (event.target === event.currentTarget) {
									focusPasswordInput();
								}
							}}
						>
							<input
								ref={inputRef}
								id="admin-unlock-password"
								type={showPassword ? "text" : "password"}
								value={password}
								onChange={(event) => onPasswordChange(event.target.value)}
								className="h-full min-w-0 flex-1 bg-transparent px-4 text-base text-white placeholder:text-slate-500 focus:outline-none"
								placeholder="Yönetici parolasını girin"
								autoComplete="current-password"
								disabled={isSubmitting}
							/>
							<button
								type="button"
								onPointerDown={(event) => event.preventDefault()}
								onClick={() => {
									setShowPassword((current) => !current);
									focusPasswordInput();
								}}
								aria-label={showPassword ? "Parolayı gizle" : "Parolayı göster"}
								aria-pressed={showPassword}
								className="mr-1.5 inline-flex h-8 shrink-0 items-center rounded-md border border-slate-600 px-2.5 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-400 hover:text-white"
							>
								{showPassword ? "Gizle" : "Göster"}
							</button>
						</div>
					</div>

					{error ? (
						<div
							role="alert"
							className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
						>
							{error}
						</div>
					) : null}

					<div className="flex gap-3 pt-1">
						<button
							type="button"
							onClick={onClose}
							className="flex-1 rounded-lg border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-50"
							disabled={isSubmitting}
						>
							Vazgeç
						</button>
						<button
							type="submit"
							className="flex-1 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
							disabled={isSubmitting || password.trim().length === 0}
						>
							{isSubmitting ? "Doğrulanıyor..." : "Ayarları Aç"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

export function KasaApp({ onReconfigure }: { onReconfigure: () => void }) {
	const hydrate = useOrderStore((s) => s.hydrate);
	const applyWsEvent = useOrderStore((s) => s.applyWsEvent);
	const setConnected = useOrderStore((s) => s.setConnected);
	const connected = useOrderStore((s) => s.connected);
	const loading = useOrderStore((s) => s.loading);
	const hydrateSettings = useSettingsStore((s) => s.hydrate);
	const [unlockModalOpen, setUnlockModalOpen] = useState(false);
	const [unlockPassword, setUnlockPassword] = useState("");
	const [unlockError, setUnlockError] = useState<string | null>(null);
	const [unlocking, setUnlocking] = useState(false);

	const onMessage = useCallback(
		(msg: WsMessage) => {
			applyWsEvent(msg);
			if (msg.event === WS_EVENTS.SETTINGS_UPDATED) {
				const payload = msg.data as SettingsUpdatedPayload | undefined;
				if (payload?.key === SETTING_KEYS.DELIVERY_TARGET_MINUTES) {
					void hydrateSettings();
				}
			}
		},
		[applyWsEvent, hydrateSettings],
	);

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
		hydrateSettings();
	}, [hydrate, hydrateSettings]);

	const closeUnlockModal = useCallback(() => {
		if (unlocking) return;
		setUnlockModalOpen(false);
		setUnlockPassword("");
		setUnlockError(null);
	}, [unlocking]);

	const handleReconfigureClick = useCallback(() => {
		if (!connected) {
			onReconfigure();
			return;
		}

		setUnlockPassword("");
		setUnlockError(null);
		setUnlockModalOpen(true);
	}, [connected, onReconfigure]);

	const handleUnlockSubmit = useCallback(
		async (event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (!unlockPassword.trim()) return;

			setUnlocking(true);
			setUnlockError(null);

			try {
				await api.verifyAdminPassword(unlockPassword);
				setUnlockModalOpen(false);
				setUnlockPassword("");
				onReconfigure();
			} catch (error) {
				setUnlockError(getUnlockErrorMessage(error));
			} finally {
				setUnlocking(false);
			}
		},
		[onReconfigure, unlockPassword],
	);

	return (
		<>
			<div className="flex h-screen flex-col overflow-hidden bg-slate-950">
				<header className="flex-shrink-0 border-b border-white/[0.06] bg-slate-900/90 px-5 py-3 backdrop-blur-sm">
					<div className="flex items-center justify-between">
						<div className="flex min-w-0 items-center gap-3">
							<BrandLogo variant="dark" className="h-9 w-auto shrink-0" />
							<h1 className="text-lg font-bold tracking-wide text-white">
								SEPET ARASI <span className="font-semibold text-slate-400">KASA</span>
							</h1>
						</div>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={handleReconfigureClick}
								className="ml-1 flex cursor-pointer items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 transition-colors hover:bg-slate-700"
								title={
									connected ? "Bağlı — ayarları değiştir" : "Bağlantı kesildi — ayarları değiştir"
								}
							>
								<span
									className={`h-2 w-2 flex-shrink-0 rounded-full ${connected ? "bg-emerald-500" : "animate-pulse bg-red-500"}`}
								/>
								<span className={`text-sm ${connected ? "text-emerald-400" : "text-red-400"}`}>
									{connected ? "Bağlı" : "Bağlantı kesildi"}
								</span>
							</button>
						</div>
					</div>
				</header>

				<div className="flex min-w-0 flex-1 overflow-hidden">
					<main className="min-w-0 flex-1 overflow-y-auto">
						{loading ? (
							<div className="flex items-center justify-center py-24">
								<div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-slate-400" />
							</div>
						) : (
							<OrderList />
						)}
					</main>

					<aside className="flex h-full min-h-0 w-80 flex-shrink-0 flex-col overflow-hidden border-l border-white/[0.06] bg-slate-900/80">
						<OrderForm />
					</aside>
				</div>
			</div>

			<AdminUnlockModal
				error={unlockError}
				isOpen={unlockModalOpen}
				isSubmitting={unlocking}
				onClose={closeUnlockModal}
				onPasswordChange={setUnlockPassword}
				onSubmit={handleUnlockSubmit}
				password={unlockPassword}
			/>
		</>
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
					<div className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-4 border-emerald-500/30 border-t-emerald-500" />
					<p className="text-lg font-medium text-white">Sunucu aranıyor...</p>
					<p className="mt-1 text-sm text-slate-400">Ağ taranıyor, lütfen bekleyin</p>
				</div>
			</div>
		);
	}

	if (!configured) {
		return <ServerConfig onConnected={() => setConfigured(true)} />;
	}

	return <KasaApp onReconfigure={() => setConfigured(false)} />;
}
