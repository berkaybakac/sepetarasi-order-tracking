import { SETTING_KEYS } from "@sepetarasi/shared";
import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import {
	DEFAULT_DISPLAY_CONFIG,
	type DisplayConfig,
	type DisplayLayoutPreference,
	type DisplayProfile,
	parseDisplaySettings,
	resolveMaxVisiblePerColumn,
} from "../display/display-config";

function areConfigsEqual(a: DisplayConfig, b: DisplayConfig): boolean {
	return (
		a.profile === b.profile &&
		a.layoutPreference === b.layoutPreference &&
		a.maxVisiblePerColumn === b.maxVisiblePerColumn &&
		a.pageSeconds === b.pageSeconds
	);
}

export function DisplaySettingsCard() {
	const [config, setConfig] = useState<DisplayConfig>(DEFAULT_DISPLAY_CONFIG);
	const [savedConfig, setSavedConfig] = useState<DisplayConfig>(DEFAULT_DISPLAY_CONFIG);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [saveLabel, setSaveLabel] = useState<"idle" | "saved">("idle");
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
			})
			.catch((err) => console.error("[DisplaySettingsCard] getSettings failed:", err))
			.finally(() => setLoading(false));
	}, []);

	const handleSave = () => {
		setSaving(true);
		Promise.all([
			api.updateSetting(SETTING_KEYS.DISPLAY_PROFILE, config.profile),
			api.updateSetting(SETTING_KEYS.DISPLAY_LAYOUT, config.layoutPreference),
			api.updateSetting(SETTING_KEYS.DISPLAY_MAX_VISIBLE, String(config.maxVisiblePerColumn)),
			api.updateSetting(SETTING_KEYS.DISPLAY_PAGE_SECONDS, String(config.pageSeconds)),
		])
			.then(() => {
				setSavedConfig(config);
				setSaveLabel("saved");
				if (timerRef.current) clearTimeout(timerRef.current);
				timerRef.current = setTimeout(() => setSaveLabel("idle"), 2000);
			})
			.catch((err) => console.error("[DisplaySettingsCard] updateSetting failed:", err))
			.finally(() => setSaving(false));
	};

	const dirty = !areConfigsEqual(config, savedConfig);
	const autoCapNote =
		config.profile === "auto"
			? config.layoutPreference === "auto"
				? "Auto profilde efektif ust sinir stack=8, split=20."
				: `Auto profilde efektif ust sinir ${config.layoutPreference} icin ${resolveMaxVisiblePerColumn(config, config.layoutPreference)}.`
			: null;

	return (
		<div className="bg-white/5 backdrop-blur-xl rounded-3xl shadow-lg shadow-black/20 border border-white/5 p-6 relative overflow-hidden group hover:border-white/10 transition-colors flex flex-col gap-4">
			<div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

			<div className="relative z-10">
				<h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
					Musteri Ekrani Ayarlari
				</h3>
				<p className="text-xs text-slate-500 mt-1">
					Profil, duzen ve sayfalama ayarlari tum display ekranlarina uygulanir.
				</p>
			</div>

			{loading ? (
				<div className="relative z-10 flex justify-center py-6">
					<div className="w-6 h-6 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
				</div>
			) : (
				<div className="relative z-10 grid grid-cols-1 gap-4">
					<label className="text-sm text-slate-300">
						<span className="block mb-1">Profil</span>
						<select
							className="w-full px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-700 text-white"
							value={config.profile}
							onChange={(e) =>
								setConfig((prev) => ({
									...prev,
									profile: e.target.value as DisplayProfile,
								}))
							}
						>
							<option value="auto">Auto</option>
							<option value="led_256x512">LED 256x512</option>
							<option value="tv_1080p">TV 1080p</option>
						</select>
					</label>

					<label className="text-sm text-slate-300">
						<span className="block mb-1">Duzen</span>
						<select
							className="w-full px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-700 text-white"
							value={config.layoutPreference}
							onChange={(e) =>
								setConfig((prev) => ({
									...prev,
									layoutPreference: e.target.value as DisplayLayoutPreference,
								}))
							}
						>
							<option value="auto">Auto</option>
							<option value="split">Yan Yana</option>
							<option value="stack">Altli Ustlu</option>
						</select>
					</label>

					<div className="grid grid-cols-2 gap-3">
						<label className="text-sm text-slate-300">
							<span className="block mb-1">Max Siparis / Kolon</span>
							<input
								type="number"
								min={1}
								max={120}
								value={config.maxVisiblePerColumn}
								onChange={(e) =>
									setConfig((prev) => ({
										...prev,
										maxVisiblePerColumn: Math.max(1, Math.min(120, Number(e.target.value) || 1)),
									}))
								}
								className="w-full px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-700 text-white"
							/>
						</label>

						<label className="text-sm text-slate-300">
							<span className="block mb-1">Sayfa Suresi (sn)</span>
							<input
								type="number"
								min={3}
								max={30}
								value={config.pageSeconds}
								onChange={(e) =>
									setConfig((prev) => ({
										...prev,
										pageSeconds: Math.max(3, Math.min(30, Number(e.target.value) || 3)),
									}))
								}
								className="w-full px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-700 text-white"
							/>
						</label>
					</div>
					{autoCapNote && <p className="text-xs text-amber-300/80">{autoCapNote}</p>}
				</div>
			)}

			<div className="relative z-10 flex items-center justify-end gap-3 h-10">
				{saveLabel === "saved" && (
					<span className="text-sm font-medium text-brand-success">Kaydedildi</span>
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
					Kaydet
				</button>
			</div>
		</div>
	);
}
