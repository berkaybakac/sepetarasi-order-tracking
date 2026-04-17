import { type SubmitEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrandLogo } from "../../components/BrandLogo";
import { LockIcon } from "../../components/icons";
import { useBootScreenReady } from "../../hooks/useBootScreenReady";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/auth.store";
import { getErrorMessage } from "../../utils/error";
import { AuthShell } from "./ui/AuthShell";
import { ActionButton, Field, InlineAlert, PasswordInput } from "./ui/primitives";

export function LoginView() {
	useBootScreenReady(true);

	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const navigate = useNavigate();
	const { setAuthStatus } = useAuthStore();

	const handleLogin = async (e: SubmitEvent<HTMLFormElement>) => {
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
		<AuthShell
			aside={
				<section className="hidden rounded-[2.2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(10,18,31,0.82),rgba(8,14,24,0.72))] p-10 shadow-[0_24px_72px_rgba(2,6,23,0.26)] backdrop-blur-sm lg:flex lg:min-h-[35rem] lg:flex-col">
					<p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-text-subtle/90">
						Sepetarası
					</p>

					<BrandLogo
						variant="dark"
						className="mt-8 h-auto w-full max-w-[13.5rem] drop-shadow-[0_20px_42px_rgba(15,23,42,0.35)]"
					/>

					<div className="mt-10 max-w-[34rem]">
						<h1 className="text-[clamp(2.3rem,3.7vw,3.8rem)] font-semibold leading-[0.96] tracking-tight text-text-strong">
							Mağaza operasyonu
							<span className="block">tek panelde.</span>
						</h1>

						<p className="mt-5 max-w-[31rem] text-[1.04rem] leading-8 text-text-muted">
							Sipariş akışını, müşteri ekranını ve mağaza içi ses davranışını tek merkezden yönetin.
						</p>
					</div>

					<div className="mt-auto flex flex-wrap gap-3 pt-10">
						<span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-text-muted">
							Canlı sipariş akışı
						</span>
						<span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-text-muted">
							Müşteri ekranı
						</span>
						<span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-text-muted">
							Mağaza içi ses
						</span>
					</div>
				</section>
			}
		>
			<section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,31,0.94),rgba(8,14,25,0.9))] p-6 shadow-[0_24px_64px_rgba(2,6,23,0.32)] backdrop-blur-xl sm:p-8">
				<div className="lg:hidden">
					<BrandLogo
						variant="dark"
						className="h-auto w-full max-w-[5rem] drop-shadow-[0_16px_32px_rgba(15,23,42,0.28)]"
					/>
					<p className="mt-4 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-text-subtle/90">
						Sepetarası
					</p>
				</div>

				<div className="mt-6 flex items-center gap-3 lg:mt-0">
					<span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] text-brand-primary">
						<LockIcon className="h-5 w-5" />
					</span>
					<div>
						<p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-brand-primary/85">
							Yönetici erişimi
						</p>
						<h2 className="mt-1 text-[1.72rem] font-semibold tracking-tight text-text-strong">
							Giriş yapın
						</h2>
					</div>
				</div>

				<p className="mt-4 text-sm leading-7 text-text-subtle">
					Bu alan yalnızca yetkili yönetici parolasıyla açılır. Oturum bilgisi güvenli çerezlerle
					korunur.
				</p>

				<form onSubmit={handleLogin} className="mt-7 space-y-5">
					<Field htmlFor="admin-password" label="Yönetici Parolası">
						<PasswordInput
							id="admin-password"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							placeholder="Parolanızı girin"
							autoComplete="current-password"
							autoFocus
							required
						/>
					</Field>

					{error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

					<ActionButton
						type="submit"
						tone="primary"
						busy={isLoading}
						className="h-12 w-full [background:linear-gradient(180deg,rgba(92,214,232,0.92),rgba(38,166,190,0.9))] shadow-[0_16px_36px_rgba(34,211,238,0.14)] hover:brightness-[1.04]"
						disabled={!password}
					>
						{isLoading ? "Giriş Yapılıyor..." : "Giriş Yap"}
					</ActionButton>
				</form>
			</section>
		</AuthShell>
	);
}
