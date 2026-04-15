import { type SubmitEvent, useState } from "react";
import { NavLink } from "react-router-dom";
import { BasketIcon } from "../../components/BasketIcon";
import { UI_LABELS } from "../../constants/labels";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/auth.store";
import { getErrorMessage } from "../../utils/error";

const TABS = [
	{
		to: "/admin/orders",
		label: "Siparişler",
		icon: (
			<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<title>siparişler</title>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
				/>
			</svg>
		),
	},
	{
		to: "/admin/audio",
		label: "Ses & Müzik",
		icon: (
			<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<title>ses müzik</title>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
				/>
			</svg>
		),
	},
	{
		to: "/admin/display",
		label: "Ekran",
		icon: (
			<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<title>ekran</title>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
				/>
			</svg>
		),
	},
	{
		to: "/admin/notes",
		label: "Hızlı Notlar",
		icon: (
			<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<title>hızlı notlar</title>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
				/>
			</svg>
		),
	},
	{
		to: "/admin/stats",
		label: "İstatistikler",
		icon: (
			<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<title>istatistikler</title>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
				/>
			</svg>
		),
	},
] as const;

export function AdminHeader({ connected }: { connected: boolean }) {
	const { logout } = useAuthStore();
	const [showModal, setShowModal] = useState(false);
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [message, setMessage] = useState<{ text: string; type: "error" | "success" } | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	const handleLogout = async () => {
		try {
			await api.authLogout();
		} catch (e) {
			// ignore logout err
		}
		logout();
	};

	const handleChangePassword = async (e: SubmitEvent<HTMLFormElement>) => {
		e.preventDefault();
		setMessage(null);

		if (newPassword.length < 6) {
			setMessage({ text: "Yeni parola en az 6 karakter olmalıdır.", type: "error" });
			return;
		}

		setIsLoading(true);
		try {
			await api.authChangePassword(currentPassword, newPassword);
			setMessage({ text: "Parolanız başarıyla güncellendi.", type: "success" });
			setTimeout(() => {
				setShowModal(false);
				setMessage(null);
				setCurrentPassword("");
				setNewPassword("");
			}, 2000);
		} catch (err) {
			setMessage({ text: getErrorMessage(err, "Bir hata oluştu"), type: "error" });
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<>
			<header className="bg-slate-900/50 backdrop-blur-md border-b border-white/5 sticky top-0 z-40 transition-all">
				{/* Top bar: logo + auth buttons */}
				<div className="flex items-center justify-between max-w-7xl mx-auto px-6 py-3">
					<div className="flex items-center gap-3">
						<div className="w-8 h-8 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/25">
							<BasketIcon size={20} className="text-white" strokeWidth={2} />
						</div>
						<h1 className="text-xl font-bold text-white tracking-tight">{UI_LABELS.ADMIN_TITLE}</h1>
						<span
							className={`ml-2 w-2.5 h-2.5 rounded-full ${connected ? "bg-brand-success shadow-[0_0_12px_rgba(16,185,129,0.8)] animate-pulse" : "bg-brand-danger shadow-[0_0_12px_rgba(239,68,68,0.8)]"}`}
							title={connected ? "Bağlı" : "Bağlantı Koptu"}
						/>
					</div>

					<div className="flex gap-3">
						<button
							type="button"
							onClick={() => setShowModal(true)}
							className="px-4 py-2 text-sm font-medium text-slate-300 bg-white/5 hover:bg-white/10 hover:text-white rounded-xl transition-all border border-white/5 backdrop-blur-sm"
						>
							Parola Değiştir
						</button>
						<button
							type="button"
							onClick={handleLogout}
							className="px-4 py-2 text-sm font-medium text-brand-danger bg-brand-danger/10 hover:bg-brand-danger/20 rounded-xl transition-all border border-brand-danger/20 backdrop-blur-sm"
						>
							Çıkış Yap
						</button>
					</div>
				</div>

				{/* Tab navigation */}
				<nav className="max-w-7xl mx-auto px-6 pb-0 flex gap-1" aria-label="Ana navigasyon">
					{TABS.map((tab) => (
						<NavLink
							key={tab.to}
							to={tab.to}
							className={({ isActive }) =>
								`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl border-b-2 transition-all ${
									isActive
										? "text-white border-blue-500 bg-white/5"
										: "text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5"
								}`
							}
						>
							{tab.icon}
							{tab.label}
						</NavLink>
					))}
				</nav>
			</header>

			{/* Parola Değiştir Modal - Dark Theme */}
			{showModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-opacity">
					<div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
						<div className="px-6 py-5 border-b border-white/5 flex justify-between items-center">
							<h3 className="font-semibold text-white text-lg flex items-center gap-2">
								<BasketIcon size={20} className="text-brand-primary" strokeWidth={2} />
								Güvenlik Ayarları
							</h3>
							<button
								type="button"
								onClick={() => setShowModal(false)}
								className="text-slate-400 hover:text-white transition-colors p-1 bg-white/5 hover:bg-white/10 rounded-lg"
							>
								<svg
									className="w-5 h-5"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									aria-hidden="true"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</button>
						</div>

						<form onSubmit={handleChangePassword} className="p-6 space-y-5">
							{message && (
								<div
									aria-live="polite"
									className={`p-4 rounded-xl text-sm flex items-start gap-2 ${message.type === "error" ? "bg-brand-danger/10 text-brand-danger border border-brand-danger/20" : "bg-brand-success/10 text-brand-success border border-brand-success/20"}`}
								>
									<svg
										className="w-5 h-5 shrink-0 mt-0.5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										aria-hidden="true"
									>
										{message.type === "error" ? (
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth="2"
												d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
											/>
										) : (
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth="2"
												d="M5 13l4 4L19 7"
											/>
										)}
									</svg>
									<span>{message.text}</span>
								</div>
							)}

							<div>
								<label
									htmlFor="current-password"
									className="block text-sm font-medium text-slate-300 mb-2"
								>
									Mevcut Parola
								</label>
								<input
									id="current-password"
									type="password"
									value={currentPassword}
									onChange={(e) => setCurrentPassword(e.target.value)}
									className="w-full px-4 py-3 bg-slate-950/50 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder-slate-600"
									placeholder="Şu anki parolanızı girin..."
									autoComplete="current-password"
									required
								/>
							</div>

							<div>
								<label
									htmlFor="new-password"
									className="block text-sm font-medium text-slate-300 mb-2"
								>
									Yeni Parola
								</label>
								<input
									id="new-password"
									type="password"
									value={newPassword}
									onChange={(e) => setNewPassword(e.target.value)}
									className="w-full px-4 py-3 bg-slate-950/50 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder-slate-600"
									placeholder="En az 6 karakter..."
									autoComplete="new-password"
									minLength={6}
									required
								/>
							</div>

							<div className="pt-4">
								<button
									type="submit"
									disabled={isLoading}
									className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50 flex justify-center items-center"
								>
									{isLoading ? "Güncelleniyor..." : "Güncelle"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</>
	);
}
