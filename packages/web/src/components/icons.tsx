import type { ReactNode, SVGProps } from "react";

export interface IconProps extends SVGProps<SVGSVGElement> {
	title?: string;
}

function BaseIcon({ children, title, ...props }: IconProps & { children: ReactNode }) {
	return (
		<svg
			fill="none"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={1.8}
			viewBox="0 0 24 24"
			aria-hidden={title ? undefined : "true"}
			role={title ? "img" : undefined}
			{...props}
		>
			{title ? <title>{title}</title> : null}
			{children}
		</svg>
	);
}

export function OrdersIcon(props: IconProps) {
	return (
		<BaseIcon {...props}>
			<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
			<path d="M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2" />
			<path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
		</BaseIcon>
	);
}

export function AudioIcon(props: IconProps) {
	return (
		<BaseIcon {...props}>
			<path d="M9 19V6l12-3v13" />
			<circle cx="6" cy="19" r="2" />
			<circle cx="18" cy="16" r="2" />
			<path d="M9 10l12-3" />
		</BaseIcon>
	);
}

export function DisplayIcon(props: IconProps) {
	return (
		<BaseIcon {...props}>
			<path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Z" />
			<path d="M3 13h18" />
			<path d="m9 21 1-4" />
			<path d="m15 21-1-4" />
			<path d="M8 21h8" />
		</BaseIcon>
	);
}

export function NotesIcon(props: IconProps) {
	return (
		<BaseIcon {...props}>
			<path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20" />
			<path d="M13 2H6.5A2.5 2.5 0 0 0 4 4.5v15A2.5 2.5 0 0 1 6.5 17H20V9" />
			<path d="m15 5 4 4" />
			<path d="M16 4.2a2.3 2.3 0 1 1 3.2 3.2L12 14.6l-4 1 1-4Z" />
		</BaseIcon>
	);
}

export function StatsIcon(props: IconProps) {
	return (
		<BaseIcon {...props}>
			<path d="M4 19V9" />
			<path d="M12 19V5" />
			<path d="M20 19v-8" />
			<path d="M2 19h20" />
		</BaseIcon>
	);
}

export function LockIcon(props: IconProps) {
	return (
		<BaseIcon {...props}>
			<rect x="4" y="11" width="16" height="10" rx="2" />
			<path d="M8 11V8a4 4 0 0 1 8 0v3" />
		</BaseIcon>
	);
}

export function LogoutIcon(props: IconProps) {
	return (
		<BaseIcon {...props}>
			<path d="M16 17l5-5-5-5" />
			<path d="M21 12H9" />
			<path d="M12 19H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />
		</BaseIcon>
	);
}

export function CheckIcon(props: IconProps) {
	return (
		<BaseIcon {...props}>
			<path d="m5 12 4 4L19 6" />
		</BaseIcon>
	);
}

export function AlertTriangleIcon(props: IconProps) {
	return (
		<BaseIcon {...props}>
			<path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z" />
			<path d="M12 9v4" />
			<path d="M12 17h.01" />
		</BaseIcon>
	);
}

export function RefreshIcon(props: IconProps) {
	return (
		<BaseIcon {...props}>
			<path d="M20 11a8 8 0 0 0-15.5-2M4 13a8 8 0 0 0 15.5 2" />
			<path d="M4 4v5h5" />
			<path d="M20 20v-5h-5" />
		</BaseIcon>
	);
}

export function ExternalLinkIcon(props: IconProps) {
	return (
		<BaseIcon {...props}>
			<path d="M14 5h5v5" />
			<path d="M10 14 19 5" />
			<path d="M19 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
		</BaseIcon>
	);
}

export function PlusIcon(props: IconProps) {
	return (
		<BaseIcon {...props}>
			<path d="M12 5v14" />
			<path d="M5 12h14" />
		</BaseIcon>
	);
}

export function MinusIcon(props: IconProps) {
	return (
		<BaseIcon {...props}>
			<path d="M5 12h14" />
		</BaseIcon>
	);
}

export function ClockIcon(props: IconProps) {
	return (
		<BaseIcon {...props}>
			<circle cx="12" cy="12" r="9" />
			<path d="M12 7v5l3 3" />
		</BaseIcon>
	);
}

export function CloseIcon(props: IconProps) {
	return (
		<BaseIcon {...props}>
			<path d="m18 6-12 12" />
			<path d="m6 6 12 12" />
		</BaseIcon>
	);
}

export function SparkIcon(props: IconProps) {
	return (
		<BaseIcon {...props}>
			<path d="m12 3 1.8 4.6L18 9.4l-4.2 1.8L12 16l-1.8-4.8L6 9.4l4.2-1.8L12 3Z" />
			<path d="M5 18h.01" />
			<path d="M19 18h.01" />
		</BaseIcon>
	);
}

export function EyeIcon(props: IconProps) {
	return (
		<BaseIcon {...props}>
			<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
			<circle cx="12" cy="12" r="3" />
		</BaseIcon>
	);
}

export function EyeOffIcon(props: IconProps) {
	return (
		<BaseIcon {...props}>
			<path d="M3 3 21 21" />
			<path d="M10.6 10.7a3 3 0 0 0 3.7 3.7" />
			<path d="M9.9 5.2A10.5 10.5 0 0 1 12 5c6 0 9.5 7 9.5 7a15.2 15.2 0 0 1-3 3.6" />
			<path d="M6.6 6.7A15.4 15.4 0 0 0 2.5 12s3.5 7 9.5 7a10.8 10.8 0 0 0 3-.4" />
		</BaseIcon>
	);
}
