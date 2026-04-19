import type {
	ButtonHTMLAttributes,
	HTMLAttributes,
	InputHTMLAttributes,
	ReactNode,
	PointerEvent as ReactPointerEvent,
	SelectHTMLAttributes,
} from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, CloseIcon, EyeIcon, EyeOffIcon } from "../../../components/icons";
import { cn } from "../../../lib/cn";

const BUTTON_TONES = {
	primary:
		"bg-gradient-to-r from-brand-primary to-brand-accent-strong text-slate-950 shadow-[0_16px_40px_rgba(14,165,233,0.25)] hover:brightness-110",
	secondary:
		"border border-border-strong bg-white/8 text-text-strong hover:bg-white/12 hover:border-white/25",
	ghost:
		"border border-transparent bg-transparent text-text-muted hover:bg-white/8 hover:text-text-strong",
	danger:
		"border border-brand-danger/35 bg-brand-danger/12 text-rose-100 hover:bg-brand-danger/18 hover:border-brand-danger/50",
} as const;

const ALERT_TONES = {
	info: "border-brand-primary/30 bg-brand-primary/10 text-cyan-100",
	success: "border-brand-success/30 bg-brand-success/10 text-emerald-100",
	warning: "border-brand-warning/30 bg-brand-warning/10 text-amber-100",
	danger: "border-brand-danger/30 bg-brand-danger/10 text-rose-100",
} as const;

const METRIC_TONES = {
	neutral: "bg-white/6 text-text-strong",
	info: "bg-brand-primary/10 text-cyan-100",
	success: "bg-brand-success/10 text-emerald-100",
	warning: "bg-brand-warning/10 text-amber-100",
	danger: "bg-brand-danger/10 text-rose-100",
} as const;

const ADMIN_CARD_CLASS =
	"group relative overflow-hidden rounded-panel border border-border-subtle bg-surface-2/95 p-5 shadow-elevation-1 backdrop-blur-xl";

const ADMIN_CARD_ACCENTS = {
	neutral: "",
	primary:
		"bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.08),transparent_40%)]",
	emerald:
		"bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.08),transparent_40%)]",
	violet:
		"bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.14),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.08),transparent_40%)]",
} as const;

const ADMIN_CARD_SECTION_VARIANTS = {
	inset:
		"border border-border-subtle bg-surface-1/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
	elevated:
		"border border-border-subtle bg-surface-3/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
} as const;

const ADMIN_CARD_SECTION_PADDING = {
	none: "p-0",
	sm: "p-3",
	md: "p-4",
	lg: "p-5",
} as const;

export function AppShell({ header, children }: { header: ReactNode; children: ReactNode }) {
	return (
		<div className="admin-shell-noise min-h-screen text-text-strong">
			<div className="pointer-events-none fixed inset-0 admin-grid-overlay opacity-50" />
			<div className="pointer-events-none fixed inset-0 admin-noise-overlay opacity-[0.05] mix-blend-soft-light" />
			<div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_38%)]" />
			<div className="relative z-10 min-h-screen">
				{header}
				<main className="mx-auto w-full max-w-screen-2xl px-4 pb-8 pt-5 md:px-6 xl:px-8">
					{children}
				</main>
			</div>
		</div>
	);
}

export function TopBar({
	className,
	children,
	...props
}: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
	return (
		<header
			className={cn(
				"sticky top-0 z-40 border-b border-border-subtle bg-[color:rgba(6,12,22,0.78)] backdrop-blur-xl",
				className,
			)}
			{...props}
		>
			{children}
		</header>
	);
}

interface SectionCardProps extends HTMLAttributes<HTMLDivElement> {
	title?: string;
	icon?: ReactNode;
	actions?: ReactNode;
	children: ReactNode;
}

export function SectionCard({
	title,
	icon,
	actions,
	children,
	className,
	...props
}: SectionCardProps) {
	return (
		<section
			className={cn(
				"rounded-panel border border-border-subtle bg-surface-2/95 p-5 shadow-elevation-1 backdrop-blur-xl",
				className,
			)}
			{...props}
		>
			{title || actions ? (
				<div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
					<div className="min-w-0">
						{title ? (
							<div className="flex items-center gap-2">
								{icon ? (
									<span className="flex h-8 w-8 items-center justify-center rounded-xl border border-border-subtle bg-white/6 text-brand-primary">
										{icon}
									</span>
								) : null}
								<div>
									<h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
										{title}
									</h2>
								</div>
							</div>
						) : null}
					</div>
					{actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
				</div>
			) : null}
			{children}
		</section>
	);
}

interface BaseAdminCardProps extends HTMLAttributes<HTMLElement> {
	title?: string;
	description?: string;
	icon?: ReactNode;
	actions?: ReactNode;
	accent?: keyof typeof ADMIN_CARD_ACCENTS;
	bodyClassName?: string;
	stretchBody?: boolean;
	children: ReactNode;
}

export function BaseAdminCard({
	title,
	description,
	icon,
	actions,
	accent = "neutral",
	bodyClassName,
	stretchBody = false,
	children,
	className,
	...props
}: BaseAdminCardProps) {
	const accentClass = ADMIN_CARD_ACCENTS[accent];

	return (
		<section className={cn(ADMIN_CARD_CLASS, className)} {...props}>
			{accentClass ? (
				<div
					className={cn(
						"pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100",
						accentClass,
					)}
				/>
			) : null}
			<div className={cn("relative z-10", stretchBody && "flex h-full flex-col")}>
				{title || description || actions ? (
					<div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div className="min-w-0">
							{title ? (
								<div className={cn("flex gap-3", description ? "items-start" : "items-center")}>
									{icon ? (
										<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border-subtle bg-surface-1/45 text-brand-primary">
											{icon}
										</span>
									) : null}
									<div className="min-w-0">
										<h2 className="text-lg font-semibold tracking-tight text-text-strong">
											{title}
										</h2>
										{description ? (
											<p className="mt-1 text-sm leading-6 text-text-subtle">{description}</p>
										) : null}
									</div>
								</div>
							) : description ? (
								<p className="text-sm leading-6 text-text-subtle">{description}</p>
							) : null}
						</div>
						{actions ? (
							<div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
						) : null}
					</div>
				) : null}
				<div className={cn(stretchBody && "flex flex-1 flex-col", bodyClassName)}>{children}</div>
			</div>
		</section>
	);
}

export function BaseAdminCardSection({
	variant = "inset",
	padding = "md",
	className,
	children,
	...props
}: HTMLAttributes<HTMLDivElement> & {
	children: ReactNode;
	variant?: keyof typeof ADMIN_CARD_SECTION_VARIANTS;
	padding?: keyof typeof ADMIN_CARD_SECTION_PADDING;
}) {
	return (
		<div
			className={cn(
				"rounded-[1.25rem]",
				ADMIN_CARD_SECTION_VARIANTS[variant],
				ADMIN_CARD_SECTION_PADDING[padding],
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

interface MetricTileProps {
	label: string;
	value: string | number;
	detail?: string;
	icon?: ReactNode;
	tone?: keyof typeof METRIC_TONES;
}

export function MetricTile({ label, value, detail, icon, tone = "neutral" }: MetricTileProps) {
	return (
		<BaseAdminCardSection variant="elevated" padding="lg" className="h-full">
			<div className="mb-4 flex items-start justify-between gap-4">
				<p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-subtle">
					{label}
				</p>
				{icon ? (
					<span
						className={cn(
							"flex h-9 w-9 items-center justify-center rounded-2xl border border-white/8",
							METRIC_TONES[tone],
						)}
					>
						{icon}
					</span>
				) : null}
			</div>
			<p className="text-4xl font-semibold tracking-tight text-text-strong">{value}</p>
			<p className="mt-2 min-h-5 text-sm text-text-subtle">{detail ?? "\u00A0"}</p>
		</BaseAdminCardSection>
	);
}

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	tone?: keyof typeof BUTTON_TONES;
	leadingIcon?: ReactNode;
	trailingIcon?: ReactNode;
	busy?: boolean;
	success?: boolean;
}

export function ActionButton({
	tone = "secondary",
	leadingIcon,
	trailingIcon,
	busy,
	success,
	className,
	children,
	disabled,
	type = "button",
	...props
}: ActionButtonProps) {
	return (
		<button
			type={type}
			disabled={disabled || busy}
			className={cn(
				"inline-flex h-11 items-center justify-center gap-2 rounded-[1rem] px-4 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-45",
				BUTTON_TONES[tone],
				className,
			)}
			{...props}
		>
			{busy ? (
				<span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
			) : success ? (
				<CheckIcon className="h-4 w-4" />
			) : (
				leadingIcon
			)}
			<span>{children}</span>
			{!busy && !success ? trailingIcon : null}
		</button>
	);
}

interface FieldProps {
	label: string;
	htmlFor?: string;
	hint?: string;
	error?: string | null;
	children: ReactNode;
}

export function Field({ label, htmlFor, hint, error, children }: FieldProps) {
	return (
		<div className="block text-sm text-text-muted">
			<label className="mb-1.5 block font-medium text-text-muted" htmlFor={htmlFor}>
				{label}
			</label>
			{children}
			{hint ? <span className="mt-2 block text-xs text-text-subtle">{hint}</span> : null}
			{error ? <span className="mt-2 block text-xs text-rose-200">{error}</span> : null}
		</div>
	);
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
	return (
		<input
			className={cn(
				"h-11 w-full rounded-[1rem] border border-border-subtle bg-surface-1 px-3.5 text-sm text-text-strong placeholder:text-text-subtle",
				className,
			)}
			{...props}
		/>
	);
}

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
	showLabel?: string;
	hideLabel?: string;
}

export function PasswordInput({
	className,
	showLabel = "Göster",
	hideLabel = "Gizle",
	...props
}: PasswordInputProps) {
	const [visible, setVisible] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const visibilityLabel = visible ? hideLabel : showLabel;

	const focusInput = () => {
		if (props.disabled) return;
		const input = inputRef.current;
		if (!input) return;
		input.focus();
		const cursorPosition = input.value.length;
		try {
			input.setSelectionRange(cursorPosition, cursorPosition);
		} catch {}
	};

	const isVisibilityToggleTarget = (target: EventTarget | null) =>
		target instanceof HTMLElement &&
		target.closest("[data-password-visibility-toggle]") instanceof HTMLElement;

	const handleShellPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (
			props.disabled ||
			isVisibilityToggleTarget(event.target) ||
			event.target === inputRef.current
		) {
			return;
		}

		event.preventDefault();
		focusInput();
	};

	return (
		<div
			className={cn(
				"flex h-11 items-center rounded-[1rem] border border-border-subtle bg-surface-1 transition focus-within:border-white/18 focus-within:shadow-[0_0_0_1px_rgba(8,17,31,0.7),0_0_0_4px_var(--color-focus-ring)]",
				props.disabled ? "cursor-not-allowed opacity-45" : "",
				className,
			)}
			onPointerDown={handleShellPointerDown}
		>
			<input
				ref={inputRef}
				type={visible ? "text" : "password"}
				className={cn(
					"h-full min-w-0 flex-1 bg-transparent px-3.5 text-sm text-text-strong placeholder:text-text-subtle focus:outline-none focus-visible:shadow-none",
				)}
				{...props}
			/>
			<button
				type="button"
				data-password-visibility-toggle
				disabled={props.disabled}
				onPointerDown={(event) => event.preventDefault()}
				onClick={() => {
					setVisible((current) => !current);
					focusInput();
				}}
				aria-label={visible ? "Parolayı gizle" : "Parolayı göster"}
				aria-pressed={visible}
				className="mr-1.5 inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-white/8 bg-white/[0.04] px-2.5 text-xs font-semibold text-text-muted transition hover:border-white/18 hover:text-text-strong disabled:opacity-45"
			>
				{visible ? <EyeOffIcon className="h-3.5 w-3.5" /> : <EyeIcon className="h-3.5 w-3.5" />}
				<span className="hidden sm:inline">{visibilityLabel}</span>
			</button>
		</div>
	);
}

export function SelectInput({
	className,
	children,
	...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
	return (
		<select
			className={cn(
				"h-11 w-full rounded-[1rem] border border-border-subtle bg-surface-1 px-3.5 text-sm text-text-strong",
				className,
			)}
			{...props}
		>
			{children}
		</select>
	);
}

interface NumberStepperProps {
	value: number;
	min: number;
	max?: number;
	onChange: (next: number) => void;
	decreaseLabel: string;
	increaseLabel: string;
	inputLabel: string;
	disabled?: boolean;
}

export function NumberStepper({
	value,
	min,
	max,
	onChange,
	decreaseLabel,
	increaseLabel,
	inputLabel,
	disabled,
}: NumberStepperProps) {
	const boundedValue = useMemo(() => {
		if (max === undefined) return Math.max(value, min);
		return Math.min(Math.max(value, min), max);
	}, [max, min, value]);

	return (
		<div className="flex items-stretch rounded-[1rem] border border-border-subtle bg-surface-1">
			<button
				type="button"
				onClick={() => onChange(Math.max(boundedValue - 1, min))}
				aria-label={decreaseLabel}
				className="grid w-11 place-items-center text-lg text-text-muted hover:text-text-strong disabled:opacity-40"
				disabled={disabled}
			>
				−
			</button>
			<input
				type="number"
				min={min}
				max={max}
				value={boundedValue}
				aria-label={inputLabel}
				onChange={(event) => {
					const parsed = Number.parseInt(event.target.value, 10);
					if (Number.isNaN(parsed)) {
						onChange(min);
						return;
					}
					const next =
						max === undefined ? Math.max(parsed, min) : Math.min(Math.max(parsed, min), max);
					onChange(next);
				}}
				className="number-input-no-spinner h-11 w-full bg-transparent px-2 text-center text-sm text-text-strong"
				disabled={disabled}
			/>
			<button
				type="button"
				onClick={() =>
					onChange(max === undefined ? boundedValue + 1 : Math.min(boundedValue + 1, max))
				}
				aria-label={increaseLabel}
				className="grid w-11 place-items-center text-lg text-text-muted hover:text-text-strong disabled:opacity-40"
				disabled={disabled}
			>
				+
			</button>
		</div>
	);
}

interface EmptyStateProps {
	title: string;
	description?: string;
	actionLabel?: string;
	onAction?: () => void;
	icon?: ReactNode;
	compact?: boolean;
}

export function EmptyState({
	title,
	description,
	actionLabel,
	onAction,
	icon,
	compact,
}: EmptyStateProps) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center rounded-[1.25rem] border border-dashed border-border-strong bg-white/[0.03] px-5 text-center",
				compact ? "py-7" : "py-12",
			)}
		>
			{icon ? (
				<span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-border-subtle bg-white/6 text-brand-primary">
					{icon}
				</span>
			) : null}
			<p className="text-sm font-semibold text-text-strong">{title}</p>
			{description ? <p className="mt-2 max-w-md text-sm text-text-subtle">{description}</p> : null}
			{actionLabel && onAction ? (
				<ActionButton className="mt-4" onClick={onAction} tone="secondary">
					{actionLabel}
				</ActionButton>
			) : null}
		</div>
	);
}

interface InlineAlertProps {
	tone?: keyof typeof ALERT_TONES;
	title?: string;
	children: ReactNode;
	className?: string;
}

export function InlineAlert({ tone = "info", title, children, className }: InlineAlertProps) {
	return (
		<div
			role="alert"
			aria-live="polite"
			className={cn(
				"rounded-[1rem] border px-4 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]",
				ALERT_TONES[tone],
				className,
			)}
		>
			{title ? <p className="font-semibold">{title}</p> : null}
			<div className={cn(title ? "mt-1" : "")}>{children}</div>
		</div>
	);
}

interface ModalProps {
	open: boolean;
	title: string;
	description?: string;
	onClose: () => void;
	children: ReactNode;
	footer?: ReactNode;
}

export function Modal({ open, title, description, onClose, children, footer }: ModalProps) {
	const titleId = useId();
	const descriptionId = useId();
	const panelRef = useRef<HTMLDialogElement>(null);
	const lastFocusedRef = useRef<HTMLElement | null>(null);
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	useEffect(() => {
		if (!open) return;

		lastFocusedRef.current =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const panel = panelRef.current;

		const focusFirst = () => {
			if (!panel) return;
			const findFocusable = (selector: string) =>
				Array.from(panel.querySelectorAll<HTMLElement>(selector)).find(
					(item) => !item.hasAttribute("disabled"),
				);

			const autofocusTarget = findFocusable("[data-autofocus]");
			const textEntryTarget = findFocusable("input, textarea, select");
			const fallbackTarget = findFocusable('button, [href], [tabindex]:not([tabindex="-1"])');
			const firstFocusable = autofocusTarget ?? textEntryTarget ?? fallbackTarget ?? panel;
			firstFocusable.focus();
		};

		const frame = window.requestAnimationFrame(focusFirst);
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		const handleKeyDown = (event: KeyboardEvent) => {
			if (!panel) return;
			if (event.key === "Escape") {
				event.preventDefault();
				onCloseRef.current();
				return;
			}
			if (event.key !== "Tab") return;

			const focusables = Array.from(
				panel.querySelectorAll<HTMLElement>(
					'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
				),
			).filter((item) => !item.hasAttribute("disabled"));

			if (focusables.length === 0) {
				event.preventDefault();
				panel.focus();
				return;
			}

			const first = focusables[0];
			const last = focusables[focusables.length - 1];
			const activeElement = document.activeElement;

			if (event.shiftKey && activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => {
			window.cancelAnimationFrame(frame);
			document.removeEventListener("keydown", handleKeyDown);
			document.body.style.overflow = previousOverflow;
			lastFocusedRef.current?.focus();
		};
	}, [open]);

	if (!open || typeof document === "undefined") return null;

	return createPortal(
		<div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/82 p-4 backdrop-blur-md">
			<div
				className="flex min-h-full items-center justify-center py-4"
				onMouseDown={(event) => {
					if (event.target === event.currentTarget) {
						onClose();
					}
				}}
			>
				<dialog
					ref={panelRef}
					open
					aria-modal="true"
					aria-labelledby={titleId}
					aria-describedby={description ? descriptionId : undefined}
					tabIndex={-1}
					className="relative z-10 m-0 max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-[1.75rem] border border-border-strong bg-surface-elevated p-6 shadow-elevation-3"
				>
					<div className="mb-5 flex items-start justify-between gap-4">
						<div>
							<h2 id={titleId} className="text-xl font-semibold tracking-tight text-text-strong">
								{title}
							</h2>
							{description ? (
								<p id={descriptionId} className="mt-1 text-sm text-text-subtle">
									{description}
								</p>
							) : null}
						</div>
						<button
							type="button"
							onClick={onClose}
							aria-label="Kapat"
							className="grid h-10 w-10 place-items-center rounded-2xl border border-border-subtle bg-white/5 text-text-muted hover:text-text-strong"
						>
							<CloseIcon className="h-4 w-4" />
						</button>
					</div>
					<div>{children}</div>
					{footer ? <div className="mt-6 flex items-center justify-end gap-3">{footer}</div> : null}
				</dialog>
			</div>
		</div>,
		document.body,
	);
}

export function SkeletonBlock({ className }: { className?: string }) {
	return <div className={cn("skeleton-shimmer rounded-2xl bg-white/6", className)} />;
}
