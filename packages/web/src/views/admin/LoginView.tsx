import { BasketIcon } from "@sepetarasi/shared";
import type React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/auth.store";
import { getErrorMessage } from "../../utils/error";

export function LoginView() {
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const navigate = useNavigate();
	const { setAuthStatus } = useAuthStore();

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setIsLoading(true);

		try {
			await api.authLogin(password);
			setAuthStatus(true);
			navigate("/admin");
		} catch (err) {
			setError(getErrorMessage(err, "Giriş başarısız. Parolanızı kontrol edin."));
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
			{/* Background Abstract Shapes */}
			<div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/20 rounded-full blur-[120px] pointer-events-none" />
			<div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/20 rounded-full blur-[120px] pointer-events-none" />

			<div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10 transition-all duration-300 hover:shadow-blue-500/10 hover:border-white/20">
				<div className="text-center mb-8">
					<div className="w-20 h-20 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg shadow-blue-500/25">
						<BasketIcon size={40} className="text-white" strokeWidth={2} />
					</div>
					<h1 className="text-3xl font-bold text-white tracking-tight">Yönetici Girişi</h1>
					<p className="text-slate-400 mt-2 text-sm">
						Sepetarası panelini yönetmek için giriş yapın
					</p>
				</div>

				<form onSubmit={handleLogin} className="space-y-6">
					<div>
						<label
							htmlFor="admin-password"
							className="block text-sm font-medium text-slate-300 mb-2"
						>
							Yönetici Parolası
						</label>
						<div className="relative">
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
								<svg
									className="h-5 w-5 text-slate-500"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									aria-hidden="true"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth="2"
										d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
									/>
								</svg>
							</div>
							<input
								id="admin-password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder-slate-500"
								placeholder="Parolanızı girin..."
								autoComplete="current-password"
								required
							/>
						</div>
					</div>

					{error && (
						<div
							role="alert"
							aria-live="polite"
							className="bg-brand-danger/10 border border-brand-danger/20 text-brand-danger text-sm rounded-xl p-3 flex items-start gap-2"
						>
							<svg
								className="w-5 h-5 shrink-0 mt-0.5"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								aria-hidden="true"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							<span>{error}</span>
						</div>
					)}

					<button
						type="submit"
						disabled={isLoading || !password}
						className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-blue-500/25 flex justify-center items-center gap-2"
					>
						{isLoading ? (
							<>
								<svg
									className="animate-spin h-5 w-5 text-white"
									fill="none"
									viewBox="0 0 24 24"
									aria-hidden="true"
								>
									<circle
										className="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										strokeWidth="4"
									/>
									<path
										className="opacity-75"
										fill="currentColor"
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
									/>
								</svg>
								Giriş Yapılıyor...
							</>
						) : (
							"Giriş Yap"
						)}
					</button>
				</form>
			</div>

			<div className="absolute bottom-6 text-center w-full text-slate-500 text-sm font-medium">
				Sepetarası • MVP v1.0 • Otonom Sipariş Takip
			</div>
		</div>
	);
}
