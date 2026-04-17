import type { ReactNode } from "react";
import { cn } from "../../../lib/cn";

interface AuthShellProps {
	children: ReactNode;
	aside?: ReactNode;
	className?: string;
}

export function AuthShell({ children, aside, className }: AuthShellProps) {
	if (!aside) {
		return (
			<div className="auth-shell relative min-h-screen overflow-hidden px-4 py-5 sm:px-6 lg:px-8">
				<div className="pointer-events-none absolute inset-0 auth-grid-overlay" />
				<div className="pointer-events-none absolute inset-x-0 top-0 h-[22rem] auth-glow-overlay" />
				<div className="relative z-10 mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-6xl items-center">
					<div className={cn("mx-auto w-full max-w-lg", className)}>{children}</div>
				</div>
			</div>
		);
	}

	return (
		<div className="auth-shell relative min-h-screen overflow-hidden px-4 py-5 sm:px-6 lg:px-8">
			<div className="pointer-events-none absolute inset-0 auth-grid-overlay" />
			<div className="pointer-events-none absolute inset-x-0 top-0 h-[22rem] auth-glow-overlay" />
			<div className="relative z-10 mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-6xl items-center">
				<div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.06fr)_minmax(24rem,28rem)] lg:items-center lg:gap-8">
					<div className="order-2 lg:order-1">{aside}</div>
					<div className={cn("order-1 lg:order-2", className)}>{children}</div>
				</div>
			</div>
		</div>
	);
}
