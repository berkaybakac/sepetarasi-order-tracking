import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { BrandLogo } from "../../../components/BrandLogo";
import { LockIcon, LogoutIcon } from "../../../components/icons";
import { cn } from "../../../lib/cn";
import { ActionButton, TopBar } from "../ui/primitives";

interface AdminStatusPanelProps {
	onOpenPasswordModal: () => void;
	onLogout: () => void;
	children?: ReactNode;
}

export function AdminStatusPanel({
	onOpenPasswordModal,
	onLogout,
	children,
}: AdminStatusPanelProps) {
	const [isCondensed, setIsCondensed] = useState(false);

	useEffect(() => {
		const handleScroll = () => {
			setIsCondensed(window.scrollY > 56);
		};

		handleScroll();
		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	return (
		<TopBar
			className={cn(
				"transition-[background-color,box-shadow,border-color] duration-200",
				isCondensed
					? "border-white/[0.08] bg-[color:rgba(5,10,18,0.9)] shadow-[0_18px_42px_rgba(3,7,18,0.34)]"
					: "bg-[color:rgba(6,12,22,0.78)]",
			)}
		>
			<div
				className={cn(
					"mx-auto flex w-full max-w-screen-2xl flex-col px-4 md:px-6 xl:px-8",
					isCondensed ? "gap-1.5 py-2" : "gap-2 py-2.5",
				)}
			>
				<div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
					<div className="flex min-w-0 items-center gap-2.5">
						<div
							className={cn(
								"flex items-center justify-center border border-border-subtle bg-white/[0.04] transition-[width,height,border-radius] duration-200",
								isCondensed ? "h-9 w-9 rounded-[0.95rem]" : "h-10 w-10 rounded-[1rem]",
							)}
						>
							<BrandLogo
								variant="dark"
								className={cn(
									"h-auto transition-[max-width] duration-200",
									isCondensed ? "w-full max-w-[1.65rem]" : "w-full max-w-[1.92rem]",
								)}
							/>
						</div>
						<div className="min-w-0">
							<p className="text-[0.64rem] font-semibold uppercase tracking-[0.28em] text-brand-primary">
								Sepetarası
							</p>
							<h1
								className={cn(
									"text-text-strong transition-[font-size,line-height] duration-200",
									isCondensed
										? "text-[1rem] font-semibold leading-tight tracking-tight"
										: "text-[1.58rem] font-semibold leading-[1.02] tracking-tight",
								)}
							>
								Yönetim Paneli
							</h1>
						</div>
					</div>

					<div className="flex flex-wrap gap-2 md:items-center lg:justify-end">
						<ActionButton
							tone={isCondensed ? "ghost" : "secondary"}
							leadingIcon={<LockIcon className="h-4 w-4" />}
							className={cn(isCondensed ? "h-9 px-3" : "h-10 px-3.5")}
							onClick={onOpenPasswordModal}
						>
							Parola Değiştir
						</ActionButton>
						<ActionButton
							tone="danger"
							leadingIcon={<LogoutIcon className="h-4 w-4" />}
							className={cn(isCondensed ? "h-9 px-3" : "h-10 px-3.5")}
							onClick={onLogout}
						>
							Çıkış Yap
						</ActionButton>
					</div>
				</div>

				{children ? (
					<div
						className={cn(
							"border-t border-white/[0.05] transition-[padding-top] duration-200",
							isCondensed ? "pt-1.5" : "pt-2.5",
						)}
					>
						{children}
					</div>
				) : null}
			</div>
		</TopBar>
	);
}
