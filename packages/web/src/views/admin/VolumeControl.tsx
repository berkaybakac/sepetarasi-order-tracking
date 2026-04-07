import { SETTING_KEYS } from "@sepetarasi/shared";
import { useEffect, useRef, useState } from "react";
import { UI_LABELS } from "../../constants/labels";
import { api } from "../../lib/api";

export function VolumeControl() {
	const [volume, setVolume] = useState(100);
	const [savedVolume, setSavedVolume] = useState(100);
	const [saving, setSaving] = useState(false);
	const [saveLabel, setSaveLabel] = useState<"idle" | "saved">("idle");
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		api
			.getSettings()
			.then((s) => {
				const v = Number(s[SETTING_KEYS.AUDIO_VOLUME] ?? 100);
				setVolume(v);
				setSavedVolume(v);
			})
			.catch((err) => console.error("[VolumeControl] getSettings failed:", err));
	}, []);

	const handleSave = () => {
		setSaving(true);
		api
			.updateSetting(SETTING_KEYS.AUDIO_VOLUME, String(volume))
			.then(() => {
				setSavedVolume(volume);
				setSaveLabel("saved");
				if (timerRef.current) clearTimeout(timerRef.current);
				timerRef.current = setTimeout(() => setSaveLabel("idle"), 2000);
			})
			.catch((err) => console.error("[VolumeControl] updateSetting failed:", err))
			.finally(() => setSaving(false));
	};

	const volumeChanged = volume !== savedVolume;

	return (
		<div className="bg-white/5 backdrop-blur-xl rounded-3xl shadow-lg shadow-black/20 border border-white/5 p-6 relative overflow-hidden group hover:border-white/10 transition-colors flex flex-col justify-between">
			<div className="absolute inset-0 bg-gradient-to-tr from-purple-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

			<div className="relative z-10 flex items-center justify-between mb-6">
				<h3 className="text-sm font-medium text-slate-400 flex items-center gap-2 uppercase tracking-wider">
					<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<title>volume icon</title>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
						/>
					</svg>
					{UI_LABELS.VOLUME_CONTROL}
				</h3>
				<span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
					{volume}%
				</span>
			</div>

			<div className="relative z-10 flex items-center gap-4 py-4">
				<span className="text-xs font-semibold text-slate-500 w-4 text-center">0</span>
				<div className="relative flex-1 flex items-center h-2 bg-slate-800 rounded-full">
					<div
						className="absolute h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
						style={{ width: `${volume}%` }}
					/>
					<input
						type="range"
						min={0}
						max={100}
						value={volume}
						onChange={(e) => setVolume(Number(e.target.value))}
						className="absolute w-full h-full opacity-0 cursor-pointer"
					/>
					{/* Custom thumb tracker indicator */}
					<div
						className="absolute w-4 h-4 bg-white rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)] pointer-events-none transition-transform group-hover:scale-110"
						style={{ left: `calc(${volume}% - 8px)` }}
					/>
				</div>
				<span className="text-xs font-semibold text-slate-500 w-8 text-center">100</span>
			</div>

			<div className="relative z-10 flex items-center justify-end gap-3 mt-4 h-10">
				{saveLabel === "saved" && (
					<span className="text-sm font-medium text-brand-success animate-in fade-in slide-in-from-right-2 flex items-center gap-1">
						<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<title>saved icon</title>
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
		</div>
	);
}
