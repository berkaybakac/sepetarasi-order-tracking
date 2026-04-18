import { useCallback, useEffect, useRef, useState } from "react";
import { UI_LABELS } from "../../../constants/labels";
import { ApiError } from "../../../lib/api";
import { logger } from "../../../lib/logger";
import { ActionButton, InlineAlert } from "../ui/primitives";

type ColorScheme = "blue" | "purple";

const COLORS = {
	blue: {
		bg: "from-blue-500/5 to-cyan-500/5",
		valueGradient: "from-blue-400 to-cyan-400",
		sliderGradient: "from-blue-500 to-cyan-500",
		knobGlow: "shadow-[0_0_10px_rgba(96,165,250,0.5)]",
		toggleActive: "bg-blue-500",
	},
	purple: {
		bg: "from-purple-500/5 to-pink-500/5",
		valueGradient: "from-purple-400 to-pink-400",
		sliderGradient: "from-purple-500 to-pink-500",
		knobGlow: "shadow-[0_0_10px_rgba(168,85,247,0.5)]",
		toggleActive: "bg-purple-500",
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
	const colors = COLORS[colorScheme];
	onMountRef.current = onMount;

	const loadSettings = useCallback(async () => {
		setLoading(true);
		setLoadError(null);

		try {
			const { volume: v, enabled: en } = await onMountRef.current();
			setVolume(v);
			setSavedVolume(v);
			if (en !== undefined) setEnabled(en);
		} catch (error) {
			logger.error("VolumeControlCard", "Failed to load volume settings.", error);
			setLoadError(getVolumeLoadErrorMessage(error));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadSettings();
	}, [loadSettings]);

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
		<div className="bg-white/5 backdrop-blur-xl rounded-3xl shadow-lg shadow-black/20 border border-white/5 p-6 relative overflow-hidden group hover:border-white/10 transition-colors flex min-h-full flex-col justify-between">
			<div
				className={`absolute inset-0 bg-gradient-to-tr ${colors.bg} opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`}
			/>

			<div className="relative z-10 mb-5 space-y-4">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<h3 className="flex min-w-0 items-center gap-2 text-base font-semibold text-slate-100">
							<span className="shrink-0">{icon}</span>
							<span className="min-w-0 leading-tight break-words">{title}</span>
						</h3>
						{helperText ? (
							<p className="mt-2 max-w-[18rem] text-sm leading-6 text-slate-400">{helperText}</p>
						) : null}
					</div>
					<span
						className={`shrink-0 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${colors.valueGradient}`}
					>
						{loading || loadError ? "—" : `${volume}%`}
					</span>
				</div>

				{enabledToggle && (
					<div className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/10 px-4 py-3">
						<span className="text-sm text-slate-300">
							{enabled ? enabledToggle.enabledLabel : enabledToggle.disabledLabel}
						</span>
						<button
							type="button"
							onClick={handleToggleEnabled}
							disabled={togglingEnabled}
							className={`relative h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
								enabled ? colors.toggleActive : "bg-slate-700"
							}`}
						>
							<span
								className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
									enabled ? "translate-x-5" : "translate-x-0"
								}`}
							/>
						</button>
					</div>
				)}
			</div>

			{loading ? (
				<div className="relative z-10 flex min-h-[8rem] items-center justify-center">
					<div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white/80" />
				</div>
			) : loadError ? (
				<div className="relative z-10 space-y-4">
					<InlineAlert tone="danger">{loadError}</InlineAlert>
					<div className="flex justify-end">
						<ActionButton tone="secondary" onClick={() => void loadSettings()}>
							{UI_LABELS.AUDIO.RETRY_BUTTON}
						</ActionButton>
					</div>
				</div>
			) : (
				<>
					<div className="relative z-10 rounded-2xl border border-white/5 bg-black/10 px-4 py-4">
						<div className="mb-3 flex items-center justify-between text-xs font-medium text-slate-400">
							<span>{UI_LABELS.VOLUME_CONTROL}</span>
							<span className="font-semibold text-slate-300">{volume}%</span>
						</div>
						<div className="flex items-center gap-3">
							<span className="w-4 text-center text-xs font-semibold text-slate-500">0</span>
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
							<span className="w-8 text-center text-xs font-semibold text-slate-500">100</span>
						</div>
					</div>

					<div className="relative z-10 mt-5 flex h-10 items-center justify-end gap-3">
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
							className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 text-white disabled:opacity-40 disabled:hover:bg-white/10 border border-white/5 transition-all flex items-center gap-2 backdrop-blur-sm"
						>
							{saving ? (
								<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
							) : null}
							{UI_LABELS.SAVE}
						</button>
					</div>
				</>
			)}
		</div>
	);
}
