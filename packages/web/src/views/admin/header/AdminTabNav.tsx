import { NavLink } from "react-router-dom";
import { cn } from "../../../lib/cn";
import { ADMIN_TABS } from "../admin-tabs";

export function AdminTabNav() {
	return (
		<nav
			aria-label="Ana navigasyon"
			className="mx-auto flex w-full max-w-screen-2xl gap-1 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:overflow-visible md:px-6 xl:px-8"
		>
			{ADMIN_TABS.map((tab) => (
				<NavLink
					key={tab.to}
					to={tab.to}
					title={tab.description}
					className={({ isActive }) =>
						cn(
							"group inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[0.9rem] border px-2.5 py-1.5 text-[0.95rem] font-semibold transition",
							isActive
								? "border-brand-primary/20 bg-brand-primary/[0.08] text-text-strong shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
								: "border-transparent bg-transparent text-text-muted hover:border-white/[0.06] hover:bg-white/[0.04] hover:text-text-strong",
						)
					}
				>
					<span
						className={cn(
							"flex h-6 w-6 items-center justify-center rounded-[0.72rem] border transition",
							"border-white/[0.08] bg-white/[0.04] text-brand-primary group-hover:border-white/[0.12]",
						)}
					>
						<tab.Icon className="h-[0.9rem] w-[0.9rem]" />
					</span>
					<span>{tab.label}</span>
				</NavLink>
			))}
		</nav>
	);
}
