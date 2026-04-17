import type { ReactNode } from "react";
import { cn } from "../../../lib/cn";

interface PageIntroProps {
	eyebrow: string;
	title: string;
	description?: string;
	actions?: ReactNode;
	className?: string;
}

export function PageIntro({ eyebrow, title, description, actions, className }: PageIntroProps) {
	return (
		<div
			className={cn("flex flex-col gap-1 md:flex-row md:items-end md:justify-between", className)}
		>
			<div className="min-w-0">
				<p className="text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-brand-primary">
					{eyebrow}
				</p>
				<h1 className="mt-0.5 text-[clamp(1.28rem,1.55vw,1.68rem)] font-semibold tracking-tight text-text-strong">
					{title}
				</h1>
				{description ? (
					<p className="mt-0.5 max-w-xl text-sm leading-5 text-text-subtle">{description}</p>
				) : null}
			</div>
			{actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
		</div>
	);
}
