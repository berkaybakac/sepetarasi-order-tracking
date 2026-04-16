import { parseNotePresets, serializeNotePresets } from "@sepetarasi/shared";
import { useEffect, useRef, useState } from "react";
import { UI_LABELS } from "../../constants/labels";
import { api } from "../../lib/api";

export function NotePresetsCard() {
	const [presets, setPresets] = useState<string[]>([]);
	const [savedPresets, setSavedPresets] = useState<string[]>([]);
	const [newPreset, setNewPreset] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
				const parsed = parseNotePresets(settings);
				setPresets(parsed);
				setSavedPresets(parsed);
				setErrorMessage(null);
			})
			.catch((err) => {
				console.error("[NotePresetsCard] getSettings failed:", err);
				setErrorMessage(UI_LABELS.NOTE_PRESETS.LOAD_ERROR);
			})
			.finally(() => setLoading(false));
	}, []);

	const dirty = JSON.stringify(presets) !== JSON.stringify(savedPresets);

	const handleAddPreset = () => {
		const trimmed = newPreset.trim();
		if (!trimmed) {
			setErrorMessage(UI_LABELS.NOTE_PRESETS.EMPTY_ERROR);
			return;
		}
		if (trimmed.length > 50) {
			setErrorMessage(UI_LABELS.NOTE_PRESETS.MAX_LENGTH_ERROR);
			return;
		}
		if (presets.length >= 20) {
			setErrorMessage(UI_LABELS.NOTE_PRESETS.MAX_ITEMS_ERROR);
			return;
		}
		if (presets.includes(trimmed)) {
			setErrorMessage("Bu not zaten ekli");
			return;
		}
		setPresets([...presets, trimmed]);
		setNewPreset("");
		setErrorMessage(null);
	};

	const handleRemovePreset = (idx: number) => {
		setPresets(presets.filter((_, i) => i !== idx));
	};

	const handleSave = () => {
		setSaving(true);
		setErrorMessage(null);
		api
			.updateSettingsBulk(serializeNotePresets(presets))
			.then(() => {
				setSavedPresets(presets);
				setSaveLabel("saved");
				if (timerRef.current) clearTimeout(timerRef.current);
				timerRef.current = setTimeout(() => setSaveLabel("idle"), 2000);
			})
			.catch((err) => {
				console.error("[NotePresetsCard] updateSetting failed:", err);
				setErrorMessage(UI_LABELS.NOTE_PRESETS.SAVE_ERROR);
			})
			.finally(() => setSaving(false));
	};

	return (
		<div className="bg-white/5 backdrop-blur-xl rounded-3xl shadow-lg shadow-black/20 border border-white/5 p-6 relative overflow-hidden group hover:border-white/10 transition-colors flex flex-col gap-4">
			<div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

			<div className="relative z-10">
				<h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
					{UI_LABELS.NOTE_PRESETS.TITLE}
				</h3>
				<p className="text-xs text-slate-500 mt-1">{UI_LABELS.NOTE_PRESETS.DESCRIPTION}</p>
			</div>

			{errorMessage && (
				<div className="relative z-10 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300">
					{errorMessage}
				</div>
			)}

			{loading ? (
				<div className="relative z-10 flex justify-center py-6">
					<div className="w-6 h-6 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
				</div>
			) : (
				<fieldset disabled={saving} className="relative z-10 flex flex-col gap-4">
					{/* Mevcut presetler */}
					{presets.length === 0 ? (
						<div className="text-center py-6">
							<p className="text-slate-400 text-sm">{UI_LABELS.NOTE_PRESETS.EMPTY_STATE}</p>
							<p className="text-slate-500 text-xs mt-1">
								{UI_LABELS.NOTE_PRESETS.EMPTY_STATE_HINT}
							</p>
						</div>
					) : (
						<div className="space-y-2 max-h-64 overflow-y-auto">
							{presets.map((preset, idx) => (
								<div
									key={preset}
									className="flex items-start justify-between gap-3 bg-slate-950/30 border border-slate-700 rounded-lg px-4 py-3"
								>
									<span className="min-w-0 flex-1 text-sm text-white break-words [overflow-wrap:anywhere] [word-break:break-word]">
										{preset}
									</span>
									<button
										type="button"
										onClick={() => handleRemovePreset(idx)}
										className="ml-2 px-2 py-1 text-xs text-red-300 hover:text-red-200 hover:bg-red-500/10 rounded border border-red-500/20 hover:border-red-500/50 transition-colors flex-shrink-0"
									>
										{UI_LABELS.NOTE_PRESETS.REMOVE_BUTTON}
									</button>
								</div>
							))}
						</div>
					)}

					{/* Yeni preset input */}
					<div className="flex gap-2">
						<input
							type="text"
							placeholder={UI_LABELS.NOTE_PRESETS.PLACEHOLDER}
							value={newPreset}
							onChange={(e) => setNewPreset(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									handleAddPreset();
								}
							}}
							maxLength={50}
							className="flex-1 px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-700 text-white placeholder:text-slate-600 text-sm focus:outline-none focus:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
						/>
						<button
							type="button"
							onClick={handleAddPreset}
							className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{UI_LABELS.NOTE_PRESETS.ADD_BUTTON}
						</button>
					</div>

					{/* Kaydet butonu */}
					<button
						type="button"
						onClick={handleSave}
						disabled={!dirty || saving}
						className="w-full mt-2 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:from-slate-500 disabled:to-slate-500 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{saving
							? "Kaydediliyor..."
							: saveLabel === "saved"
								? `${UI_LABELS.SAVE} ✓`
								: UI_LABELS.SAVE}
					</button>
				</fieldset>
			)}
		</div>
	);
}
