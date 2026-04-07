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
		<div className="bg-brand-surface rounded-card shadow-sm p-5">
			<p className="text-sm text-gray-500 mb-3">{UI_LABELS.VOLUME_CONTROL}</p>
			<div className="flex items-center gap-4">
				<span className="text-sm text-gray-400 w-4">0</span>
				<input
					type="range"
					min={0}
					max={100}
					value={volume}
					onChange={(e) => setVolume(Number(e.target.value))}
					className="flex-1 accent-brand-primary"
				/>
				<span className="text-sm font-medium text-gray-700 w-8 text-right">{volume}</span>
			</div>
			<div className="flex items-center justify-end gap-3 mt-3">
				{saveLabel === "saved" && (
					<span className="text-sm text-brand-success">{UI_LABELS.SAVED}</span>
				)}
				<button
					type="button"
					onClick={handleSave}
					disabled={saving || !volumeChanged}
					className="px-4 py-2 rounded-btn text-sm font-medium bg-brand-primary text-white disabled:opacity-40 hover:bg-brand-primary-hover transition-colors"
				>
					{UI_LABELS.SAVE}
				</button>
			</div>
		</div>
	);
}
