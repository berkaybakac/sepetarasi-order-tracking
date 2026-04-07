import type React from "react";
import { useState } from "react";
import { UI_LABELS } from "../../constants/labels";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/auth.store";
import { getErrorMessage } from "../../utils/error";

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

	const handleChangePassword = async (e: React.FormEvent) => {
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
			<header className="bg-slate-900/50 backdrop-blur-md border-b border-white/5 py-4 px-6 sticky top-0 z-40 transition-all">
				<div className="flex items-center justify-between max-w-7xl mx-auto">
					<div className="flex items-center gap-3">
						<div className="w-8 h-8 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/25">
							<svg
								className="w-5 h-5 text-white"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								aria-hidden="true"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
								/>
							</svg>
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
			</header>

			{/* Parola Değiştir Modal - Dark Theme */}
			{showModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-opacity">
					<div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
						<div className="px-6 py-5 border-b border-white/5 flex justify-between items-center">
							<h3 className="font-semibold text-white text-lg flex items-center gap-2">
								<svg
									className="w-5 h-5 text-brand-primary"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									aria-hidden="true"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
									/>
								</svg>
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
