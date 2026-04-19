import { useCallback, useEffect, useRef, useState } from "react";
import { UI_LABELS } from "../../../constants/labels";
import { ApiError } from "../../../lib/api";
import { logger } from "../../../lib/logger";
import { ActionButton, BaseAdminCard, BaseAdminCardSection, InlineAlert } from "../ui/primitives";

type ColorScheme = "blue" | "purple";

const COLORS = {
	blue: {
		accent: "primary",
		valueGradient: "from-blue-400 to-cyan-400",
		sliderGradient: "from-blue-500 to-cyan-500",
		knobGlow: "shadow-[0_0_10px_rgba(96,165,250,0.5)]",
		toggleActive: "bg-blue-500",
		saveButton:
			"border-brand-primary/20 bg-brand-primary/10 text-cyan-100 hover:bg-brand-primary/16",
	},
	purple: {
		accent: "violet",
		valueGradient: "from-purple-400 to-pink-400",
		sliderGradient: "from-purple-500 to-pink-500",
		knobGlow: "shadow-[0_0_10px_rgba(168,85,247,0.5)]",
		toggleActive: "bg-purple-500",
		saveButton: "border-violet-400/20 bg-violet-500/10 text-violet-100 hover:bg-violet-500/16",
	},
} as const;

interface EnabledToggleConfig {
	enabledLabel: string;
	disabledLabel: string;
	onToggle: (enabled: boolean) => Promise<unknown>;
}

interface VolumeControlCardProps {
	title: string;
	icon: React.ReactNode;
	helperText?: string;
	defaultVolume: number;
	colorScheme: ColorScheme;
	onMount: () => Promise<{ volume: number; enabled?: boolean }>;
	onSave: (volume: number) => Promise<unknown>;
	enabledToggle?: EnabledToggleConfig;
	reconnectToken?: number;
}

function getVolumeLoadErrorMessage(error: unknown) {
	if (error instanceof ApiError) {
		if (error.code === "UNAUTHORIZED") {
			return UI_LABELS.AUDIO.LOAD_AUTH_ERROR;
		}

		if (error.code === "NETWORK_ERROR" || error.code === "TIMEOUT" || error.code === "ABORTED") {
			return UI_LABELS.AUDIO.LOAD_NETWORK_ERROR;
		}
	}

	return UI_LABELS.AUDIO.LOAD_ERROR;
}

export function VolumeControlCard({
	title,
	icon,
	helperText,
	defaultVolume,
	colorScheme,
	onMount,
	onSave,
	enabledToggle,
	reconnectToken,
}: VolumeControlCardProps) {
	const [volume, setVolume] = useState(defaultVolume);
	const [savedVolume, setSavedVolume] = useState(defaultVolume);
	const [enabled, setEnabled] = useState(false);
	const [saving, setSaving] = useState(false);
	const [saveLabel, setSaveLabel] = useState<"idle" | "saved">("idle");
	const [togglingEnabled, setTogglingEnabled] = useState(false);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const onMountRef = useRef(onMount);
	const mountedRef = useRef(true);
	const colors = COLORS[colorScheme];
	onMountRef.current = onMount;

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	const loadSettings = useCallback(async () => {
		setLoading(true);
		setLoadError(null);

		try {
			const { volume: v, enabled: en } = await onMountRef.current();
			if (!mountedRef.current) return;
			setVolume(v);
			setSavedVolume(v);
			if (en !== undefined) setEnabled(en);
		} catch (error) {
			if (!mountedRef.current) return;
			logger.error("VolumeControlCard", "Failed to load volume settings.", error);
			setLoadError(getVolumeLoadErrorMessage(error));
		} finally {
			if (mountedRef.current) setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadSettings();
	}, [loadSettings]);

	useEffect(() => {
		if (reconnectToken && reconnectToken > 0 && loadError !== null) {
			void loadSettings();
		}
	}, [reconnectToken, loadError, loadSettings]);

	const handleSave = () => {
		setSaving(true);
		onSave(volume)
			.then(() => {
				setSavedVolume(volume);
				setSaveLabel("saved");
				if (timerRef.current) clearTimeout(timerRef.current);
				timerRef.current = setTimeout(() => setSaveLabel("idle"), 2000);
			})
			.catch((error) => logger.error("VolumeControlCard", "Failed to save volume.", error))
			.finally(() => setSaving(false));
	};

	const handleToggleEnabled = () => {
		if (!enabledToggle) return;
		const next = !enabled;
		setTogglingEnabled(true);
		enabledToggle
			.onToggle(next)
			.then(() => setEnabled(next))
			.catch((error) => logger.error("VolumeControlCard", "Failed to toggle enabled state.", error))
			.finally(() => setTogglingEnabled(false));
	};

	const volumeChanged = volume !== savedVolume;

	return (
		<BaseAdminCard
			title={title}
			description={helperText}
			icon={icon}
			accent={colors.accent}
			actions={
				<span
					className={`inline-flex shrink-0 rounded-2xl border border-border-subtle bg-surface-1/45 px-3 py-2 text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${colors.valueGradient}`}
				>
					{loading || loadError ? "—" : `${volume}%`}
				</span>
			}
			bodyClassName="space-y-4"
		>
			{enabledToggle ? (
				<BaseAdminCardSection className="flex items-center justify-between gap-3">
					<span className="text-sm text-text-muted">
						{enabled ? enabledToggle.enabledLabel : enabledToggle.disabledLabel}
					</span>
					<button
						type="button"
						onClick={handleToggleEnabled}
						disabled={togglingEnabled}
						className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
							enabled ? colors.toggleActive : "bg-slate-700"
						}`}
					>
						<span
							className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
								enabled ? "translate-x-5" : "translate-x-0"
							}`}
						/>
					</button>
				</BaseAdminCardSection>
			) : null}

			{loading ? (
				<div className="flex min-h-[8rem] items-center justify-center">
					<div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white/80" />
				</div>
			) : loadError ? (
				<div className="space-y-4">
					<InlineAlert tone="danger">{loadError}</InlineAlert>
					<div className="flex justify-end">
						<ActionButton tone="secondary" onClick={() => void loadSettings()}>
							{UI_LABELS.AUDIO.RETRY_BUTTON}
						</ActionButton>
					</div>
				</div>
			) : (
				<>
					<BaseAdminCardSection>
						<div className="mb-3 flex items-center justify-between text-xs font-medium text-text-subtle">
							<span>{UI_LABELS.VOLUME_CONTROL}</span>
							<span className="font-semibold text-text-muted">{volume}%</span>
						</div>
						<div className="flex items-center gap-3">
							<span className="w-4 text-center text-xs font-semibold text-text-subtle">0</span>
							<div className="relative flex h-2 flex-1 items-center rounded-full bg-slate-800">
								<div
									className={`absolute h-full rounded-full bg-gradient-to-r ${colors.sliderGradient}`}
									style={{ width: `${volume}%` }}
								/>
								<input
									type="range"
									min={0}
									max={100}
									value={volume}
									onChange={(e) => setVolume(Number(e.target.value))}
									className="absolute h-full w-full cursor-pointer opacity-0"
								/>
								<div
									className={`absolute h-4 w-4 rounded-full bg-white ${colors.knobGlow} pointer-events-none transition-transform group-hover:scale-110`}
									style={{ left: `calc(${volume}% - 8px)` }}
								/>
							</div>
							<span className="w-8 text-center text-xs font-semibold text-text-subtle">100</span>
						</div>
					</BaseAdminCardSection>

					<div className="flex flex-wrap items-center justify-end gap-3">
						{saveLabel === "saved" && (
							<span className="text-sm font-medium text-brand-success animate-in fade-in slide-in-from-right-2 flex items-center gap-1">
								<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<title>kaydedildi</title>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M5 13l4 4L19 7"
									/>
								</svg>
								{UI_LABELS.SAVED}
							</span>
						)}
						<button
							type="button"
							onClick={handleSave}
							disabled={saving || !volumeChanged}
							className={`flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold transition-all disabled:opacity-40 ${colors.saveButton}`}
						>
							{saving ? (
								<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
							) : null}
							{UI_LABELS.SAVE}
						</button>
					</div>
				</>
			)}
		</BaseAdminCard>
	);
}
