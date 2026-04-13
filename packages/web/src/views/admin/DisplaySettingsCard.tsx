import {
	DISPLAY_LAYOUT_PREFERENCES,
	DISPLAY_PROFILES,
	DISPLAY_TEXT_SCALES,
	DISPLAY_THEMES,
	SETTING_KEYS,
	type DisplayLayoutPreference,
	type DisplayProfile,
	type DisplayTextScale,
	type DisplayTheme,
} from "@sepetarasi/shared";
import { useEffect, useRef, useState } from "react";
import { UI_LABELS } from "../../constants/labels";
import { api } from "../../lib/api";
import {
	DEFAULT_DISPLAY_CONFIG,
	type DisplayConfig,
	parseDisplaySettings,
} from "../display/display-config";

function clampInt(value: number, min: number, max?: number): number {
	if (max === undefined) return Math.max(min, value);
	return Math.max(min, Math.min(max, value));
}

interface NumberStepperFieldProps {
	label: string;
	value: number;
	min: number;
	max?: number;
	onChange: (value: number) => void;
	decreaseLabel: string;
	increaseLabel: string;
}

function NumberStepperField({
	label,
	value,
	min,
	max,
	onChange,
	decreaseLabel,
	increaseLabel,
}: NumberStepperFieldProps) {
	const apply = (next: number) => onChange(clampInt(next, min, max));

		return (
			<label className="text-sm text-slate-300">
				<span className="block mb-1">{label}</span>
				<div className="flex items-stretch rounded-xl bg-slate-950/50 border border-slate-700 overflow-hidden">
					<button
						type="button"
						onClick={() => apply(value - 1)}
						aria-label={`${label} ${decreaseLabel}`}
						className="w-10 text-lg font-semibold text-slate-100 bg-slate-900/60 hover:bg-slate-800/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
					>
						-
					</button>
					<input
						type="number"
						min={min}
					max={max}
					step={1}
					value={value}
						onChange={(e) => {
							const parsed = Number.parseInt(e.target.value, 10);
							apply(Number.isNaN(parsed) ? min : parsed);
						}}
						className="number-input-no-spinner w-full px-3 py-2 bg-transparent text-white text-center focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
					/>
					<button
						type="button"
						onClick={() => apply(value + 1)}
						aria-label={`${label} ${increaseLabel}`}
						className="w-10 text-lg font-semibold text-slate-100 bg-slate-900/60 hover:bg-slate-800/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
					>
						+
					</button>
				</div>
			</label>
		);
}

function areConfigsEqual(a: DisplayConfig, b: DisplayConfig): boolean {
	return (
		a.profile === b.profile &&
		a.layoutPreference === b.layoutPreference &&
		a.maxVisiblePerColumn === b.maxVisiblePerColumn &&
		a.pageSeconds === b.pageSeconds &&
		a.restaurantName === b.restaurantName &&
		a.readyDisplayMinutes === b.readyDisplayMinutes &&
		a.textScale === b.textScale &&
		a.theme === b.theme
	);
}

const PROFILE_LABELS: Record<DisplayProfile, string> = {
	auto: UI_LABELS.DISPLAY_SETTINGS.AUTO_OPTION,
	led_256x512: "LED 256x512",
	tv_1080p: "TV 1080p",
};

const LAYOUT_LABELS: Record<DisplayLayoutPreference, string> = {
	auto: UI_LABELS.DISPLAY_SETTINGS.AUTO_OPTION,
	split: UI_LABELS.DISPLAY_SETTINGS.LAYOUT_SPLIT,
	stack: UI_LABELS.DISPLAY_SETTINGS.LAYOUT_STACK,
};

const TEXT_SCALE_LABELS: Record<DisplayTextScale, string> = {
	s: UI_LABELS.DISPLAY_SETTINGS.TEXT_SCALE_S,
	m: UI_LABELS.DISPLAY_SETTINGS.TEXT_SCALE_M,
	l: UI_LABELS.DISPLAY_SETTINGS.TEXT_SCALE_L,
};

const THEME_LABELS: Record<DisplayTheme, string> = {
	dark: UI_LABELS.DISPLAY_SETTINGS.THEME_DARK,
	light: UI_LABELS.DISPLAY_SETTINGS.THEME_LIGHT,
	vivid: UI_LABELS.DISPLAY_SETTINGS.THEME_VIVID,
	retro: UI_LABELS.DISPLAY_SETTINGS.THEME_RETRO,
};

function buildDisplaySettingsPayload(config: DisplayConfig): Record<string, string> {
	return {
		[SETTING_KEYS.RESTAURANT_NAME]: config.restaurantName,
		[SETTING_KEYS.DISPLAY_PROFILE]: config.profile,
		[SETTING_KEYS.DISPLAY_LAYOUT]: config.layoutPreference,
		[SETTING_KEYS.DISPLAY_MAX_VISIBLE]: String(config.maxVisiblePerColumn),
		[SETTING_KEYS.DISPLAY_PAGE_SECONDS]: String(config.pageSeconds),
		[SETTING_KEYS.DISPLAY_READY_MINUTES]: String(config.readyDisplayMinutes),
		[SETTING_KEYS.DISPLAY_TEXT_SCALE]: config.textScale,
		[SETTING_KEYS.DISPLAY_THEME]: config.theme,
	};
}

export function DisplaySettingsCard() {
	const [config, setConfig] = useState<DisplayConfig>(DEFAULT_DISPLAY_CONFIG);
	const [savedConfig, setSavedConfig] = useState<DisplayConfig>(DEFAULT_DISPLAY_CONFIG);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [saveLabel, setSaveLabel] = useState<"idle" | "saved">("idle");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(
		() => () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		},
		[],
	);

	useEffect(() => {
		api
			.getSettings()
			.then((settings) => {
				const parsed = parseDisplaySettings(settings);
				setConfig(parsed);
				setSavedConfig(parsed);
				setErrorMessage(null);
			})
			.catch((err) => {
				console.error("[DisplaySettingsCard] getSettings failed:", err);
				setErrorMessage(UI_LABELS.DISPLAY_SETTINGS.LOAD_ERROR);
			})
			.finally(() => setLoading(false));
	}, []);

	const handleSave = () => {
		setSaving(true);
		setErrorMessage(null);
		api
			.updateSettingsBulk(buildDisplaySettingsPayload(config))
			.then(() => {
				setSavedConfig(config);
				setSaveLabel("saved");
				if (timerRef.current) clearTimeout(timerRef.current);
				timerRef.current = setTimeout(() => setSaveLabel("idle"), 2000);
			})
			.catch((err) => {
				console.error("[DisplaySettingsCard] updateSetting failed:", err);
				setErrorMessage(UI_LABELS.DISPLAY_SETTINGS.SAVE_ERROR);
			})
			.finally(() => setSaving(false));
	};

	const dirty = !areConfigsEqual(config, savedConfig);

	const handleResetDefaults = () => {
		setConfig(DEFAULT_DISPLAY_CONFIG);
		setErrorMessage(null);
	};

	return (
		<div className="bg-white/5 backdrop-blur-xl rounded-3xl shadow-lg shadow-black/20 border border-white/5 p-6 relative overflow-hidden group hover:border-white/10 transition-colors flex flex-col gap-4">
			<div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

			<div className="relative z-10">
				<h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
					{UI_LABELS.DISPLAY_SETTINGS.TITLE}
				</h3>
				<p className="text-xs text-slate-500 mt-1">{UI_LABELS.DISPLAY_SETTINGS.DESCRIPTION}</p>
			</div>

			{loading ? (
				<div className="relative z-10 flex justify-center py-6">
					<div className="w-6 h-6 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
				</div>
			) : (
				<fieldset disabled={saving} className="relative z-10 grid grid-cols-1 gap-4">
					<label className="text-sm text-slate-300">
						<span className="block mb-1">{UI_LABELS.DISPLAY_SETTINGS.RESTAURANT_NAME_LABEL}</span>
						<input
							type="text"
							maxLength={60}
							value={config.restaurantName}
							onChange={(e) => setConfig((prev) => ({ ...prev, restaurantName: e.target.value }))}
							className="w-full px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-700 text-white placeholder:text-slate-600 focus:outline-none focus:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
							placeholder={UI_LABELS.DISPLAY_SETTINGS.RESTAURANT_NAME_PLACEHOLDER}
						/>
					</label>

					<label className="text-sm text-slate-300">
						<span className="block mb-1">{UI_LABELS.DISPLAY_SETTINGS.PROFILE_LABEL}</span>
						<select
							className="w-full px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
							value={config.profile}
							onChange={(e) =>
								setConfig((prev) => ({
									...prev,
									profile: e.target.value as DisplayProfile,
								}))
							}
						>
							{DISPLAY_PROFILES.map((profile) => (
								<option key={profile} value={profile}>
									{PROFILE_LABELS[profile]}
								</option>
							))}
						</select>
					</label>

					<label className="text-sm text-slate-300">
						<span className="block mb-1">{UI_LABELS.DISPLAY_SETTINGS.LAYOUT_LABEL}</span>
						<select
							className="w-full px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
							value={config.layoutPreference}
							onChange={(e) =>
								setConfig((prev) => ({
									...prev,
									layoutPreference: e.target.value as DisplayLayoutPreference,
								}))
							}
						>
							{DISPLAY_LAYOUT_PREFERENCES.map((layoutPreference) => (
								<option key={layoutPreference} value={layoutPreference}>
									{LAYOUT_LABELS[layoutPreference]}
								</option>
							))}
						</select>
					</label>

					<div className="grid grid-cols-2 gap-3">
						<NumberStepperField
							label={UI_LABELS.DISPLAY_SETTINGS.MAX_PER_COLUMN_LABEL}
							value={config.maxVisiblePerColumn}
							min={1}
							max={undefined}
							onChange={(value) => setConfig((prev) => ({ ...prev, maxVisiblePerColumn: value }))}
							decreaseLabel={UI_LABELS.DISPLAY_SETTINGS.DECREASE}
							increaseLabel={UI_LABELS.DISPLAY_SETTINGS.INCREASE}
						/>

						<NumberStepperField
							label={UI_LABELS.DISPLAY_SETTINGS.PAGE_SECONDS_LABEL}
							value={config.pageSeconds}
							min={1}
							max={undefined}
							onChange={(value) => setConfig((prev) => ({ ...prev, pageSeconds: value }))}
							decreaseLabel={UI_LABELS.DISPLAY_SETTINGS.DECREASE}
							increaseLabel={UI_LABELS.DISPLAY_SETTINGS.INCREASE}
						/>
					</div>

					<NumberStepperField
						label={UI_LABELS.DISPLAY_SETTINGS.READY_DISPLAY_MINUTES_LABEL}
						value={config.readyDisplayMinutes}
						min={1}
						max={60}
						onChange={(value) => setConfig((prev) => ({ ...prev, readyDisplayMinutes: value }))}
						decreaseLabel={UI_LABELS.DISPLAY_SETTINGS.DECREASE}
						increaseLabel={UI_LABELS.DISPLAY_SETTINGS.INCREASE}
					/>

					<div className="grid grid-cols-2 gap-3">
						<label className="text-sm text-slate-300">
							<span className="block mb-1">{UI_LABELS.DISPLAY_SETTINGS.TEXT_SCALE_LABEL}</span>
							<select
								className="w-full px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
								value={config.textScale}
								onChange={(e) =>
									setConfig((prev) => ({ ...prev, textScale: e.target.value as DisplayTextScale }))
								}
							>
								{DISPLAY_TEXT_SCALES.map((textScale) => (
									<option key={textScale} value={textScale}>
										{TEXT_SCALE_LABELS[textScale]}
									</option>
								))}
							</select>
						</label>

						<label className="text-sm text-slate-300">
							<span className="block mb-1">{UI_LABELS.DISPLAY_SETTINGS.THEME_LABEL}</span>
							<select
								className="w-full px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
								value={config.theme}
								onChange={(e) =>
									setConfig((prev) => ({ ...prev, theme: e.target.value as DisplayTheme }))
								}
							>
								{DISPLAY_THEMES.map((theme) => (
									<option key={theme} value={theme}>
										{THEME_LABELS[theme]}
									</option>
								))}
							</select>
						</label>
					</div>
					{errorMessage && (
						<p className="text-xs text-rose-100/95 bg-rose-500/10 border border-rose-300/20 rounded-lg px-3 py-2">
							{errorMessage}
						</p>
					)}
				</fieldset>
			)}

			<div className="relative z-10 flex items-center justify-end gap-3 h-10">
				<button
					type="button"
					onClick={handleResetDefaults}
					disabled={loading || saving}
					className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-800/60 hover:bg-slate-700/70 text-slate-100 disabled:opacity-40 border border-slate-600/40 transition-all"
				>
					{UI_LABELS.DISPLAY_SETTINGS.RESET_DEFAULTS}
				</button>
				{saveLabel === "saved" && (
					<span className="text-sm font-medium text-brand-success">{UI_LABELS.SAVED}</span>
				)}
				<button
					type="button"
					onClick={handleSave}
					disabled={loading || saving || !dirty}
					className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 text-white disabled:opacity-40 disabled:hover:bg-white/10 border border-white/5 transition-all flex items-center gap-2 backdrop-blur-sm"
				>
					{saving ? (
						<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
					) : null}
					{UI_LABELS.SAVE}
				</button>
			</div>
		</div>
	);
}
