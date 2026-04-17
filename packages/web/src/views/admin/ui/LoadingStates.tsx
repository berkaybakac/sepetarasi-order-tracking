import { BrandLogo } from "../../../components/BrandLogo";
import { useBootScreenReady } from "../../../hooks/useBootScreenReady";
import { AuthShell } from "./AuthShell";
import { SkeletonBlock } from "./primitives";

export function AdminBootSplash() {
	useBootScreenReady(false);

	return (
		<AuthShell>
			<section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,31,0.94),rgba(8,14,25,0.9))] p-6 shadow-[0_24px_64px_rgba(2,6,23,0.32)] backdrop-blur-xl sm:p-8">
				<BrandLogo
					variant="dark"
					className="h-auto w-full max-w-[5rem] drop-shadow-[0_16px_32px_rgba(15,23,42,0.28)]"
				/>
				<p className="mt-4 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-text-subtle/90">
					Sepetarası
				</p>
				<h1 className="mt-2 text-[1.72rem] font-semibold tracking-tight text-text-strong">
					Giriş katmanı hazırlanıyor
				</h1>

				<p className="mt-4 text-sm leading-7 text-text-subtle">
					Yetkili oturum kontrolü kurulurken ilk ekran tek katmanda tutulur.
				</p>

				<div className="mt-7 space-y-3">
					<SkeletonBlock className="h-11 w-full rounded-[1rem]" />
					<SkeletonBlock className="h-11 w-full rounded-[1rem]" />
					<SkeletonBlock className="h-3 w-32 rounded-full" />
				</div>
			</section>
		</AuthShell>
	);
}

export function AdminTabSkeleton() {
	return (
		<div className="space-y-6">
			<SkeletonBlock className="h-36 w-full rounded-panel" />
			<div className="grid gap-4 lg:grid-cols-3">
				<SkeletonBlock className="h-[20rem] rounded-panel" />
				<SkeletonBlock className="h-[20rem] rounded-panel" />
				<SkeletonBlock className="h-[20rem] rounded-panel" />
			</div>
		</div>
	);
}
