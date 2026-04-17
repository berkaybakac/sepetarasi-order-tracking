import { parseNotePresets, serializeNotePresets } from "@sepetarasi/shared";
import { useEffect, useState } from "react";
import { NotesIcon, PlusIcon } from "../../components/icons";
import { UI_LABELS } from "../../constants/labels";
import { useActionFeedback } from "../../hooks/useActionFeedback";
import { api } from "../../lib/api";
import { logger } from "../../lib/logger";
import {
	ActionButton,
	EmptyState,
	Field,
	InlineAlert,
	SectionCard,
	SkeletonBlock,
	TextInput,
} from "./ui/primitives";

export function NotePresetsCard() {
	const [presets, setPresets] = useState<string[]>([]);
	const [savedPresets, setSavedPresets] = useState<string[]>([]);
	const [newPreset, setNewPreset] = useState("");
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const feedback = useActionFeedback();

	useEffect(() => {
		api
			.getSettings()
			.then((settings) => {
				const parsed = parseNotePresets(settings);
				setPresets(parsed);
				setSavedPresets(parsed);
				setLoadError(null);
			})
			.catch((error) => {
				logger.error("NotePresetsCard", "Failed to load note presets.", error);
				setLoadError(UI_LABELS.NOTE_PRESETS.LOAD_ERROR);
			})
			.finally(() => setLoading(false));
	}, []);

	const dirty = JSON.stringify(presets) !== JSON.stringify(savedPresets);

	const handleAddPreset = () => {
		const trimmed = newPreset.trim();
		if (!trimmed) {
			feedback.setError(
				new Error(UI_LABELS.NOTE_PRESETS.EMPTY_ERROR),
				UI_LABELS.NOTE_PRESETS.EMPTY_ERROR,
			);
			return;
		}
		if (trimmed.length > 50) {
			feedback.setError(
				new Error(UI_LABELS.NOTE_PRESETS.MAX_LENGTH_ERROR),
				UI_LABELS.NOTE_PRESETS.MAX_LENGTH_ERROR,
			);
			return;
		}
		if (presets.length >= 20) {
			feedback.setError(
				new Error(UI_LABELS.NOTE_PRESETS.MAX_ITEMS_ERROR),
				UI_LABELS.NOTE_PRESETS.MAX_ITEMS_ERROR,
			);
			return;
		}
		if (presets.includes(trimmed)) {
			feedback.setError(new Error("Bu not zaten ekli"), "Bu not zaten ekli");
			return;
		}
		setPresets([...presets, trimmed]);
		setNewPreset("");
		feedback.reset();
	};

	const handleRemovePreset = (idx: number) => {
		setPresets(presets.filter((_, i) => i !== idx));
	};

	const handleSave = async () => {
		feedback.setPending();
		try {
			await api.updateSettingsBulk(serializeNotePresets(presets));
			setSavedPresets(presets);
			feedback.setSuccess(UI_LABELS.SAVED);
		} catch (error) {
			logger.error("NotePresetsCard", "Failed to save note presets.", error);
			feedback.setError(error, UI_LABELS.NOTE_PRESETS.SAVE_ERROR);
		}
	};

	return (
		<SectionCard
			title={UI_LABELS.NOTE_PRESETS.TITLE}
			description="Bu notlar kasa tarafında hazır chip olarak görünür. Kısa ve tekrar eden notlar için kullanın."
			icon={<NotesIcon className="h-4 w-4" />}
		>
			{loading ? (
				<div className="space-y-4">
					<SkeletonBlock className="h-11 w-full" />
					<SkeletonBlock className="h-24 w-full" />
					<SkeletonBlock className="h-24 w-full" />
				</div>
			) : (
				<fieldset disabled={feedback.isPending} className="flex flex-col gap-4">
					{loadError ? <InlineAlert tone="danger">{loadError}</InlineAlert> : null}
					{feedback.isError && feedback.message ? (
						<InlineAlert tone="danger">{feedback.message}</InlineAlert>
					) : null}

					{presets.length === 0 ? (
						<EmptyState
							title={UI_LABELS.NOTE_PRESETS.EMPTY_STATE}
							description="İlk notu ekleyin; kasa ekranında tek dokunuşla kullanılabilir hale gelsin."
							icon={<NotesIcon className="h-5 w-5" />}
							compact
						/>
					) : (
						<div className="max-h-72 space-y-2 overflow-y-auto">
							{presets.map((preset, idx) => (
								<div
									key={preset}
									className="flex items-start justify-between gap-3 rounded-[1rem] border border-border-subtle bg-surface-1 px-4 py-3"
								>
									<span className="min-w-0 flex-1 break-words text-sm text-text-strong [overflow-wrap:anywhere] [word-break:break-word]">
										{preset}
									</span>
									<ActionButton
										tone="ghost"
										className="h-9 px-3 text-xs"
										onClick={() => handleRemovePreset(idx)}
									>
										{UI_LABELS.NOTE_PRESETS.REMOVE_BUTTON}
									</ActionButton>
								</div>
							))}
						</div>
					)}

					<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
						<Field
							htmlFor="note-preset-input"
							label="Yeni Hızlı Not"
							hint="Maksimum 50 karakter. Enter ile hemen eklenir."
						>
							<TextInput
								id="note-preset-input"
								type="text"
								placeholder={UI_LABELS.NOTE_PRESETS.PLACEHOLDER}
								value={newPreset}
								onChange={(event) => setNewPreset(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										event.preventDefault();
										handleAddPreset();
									}
								}}
								maxLength={50}
							/>
						</Field>
						<ActionButton
							tone="secondary"
							className="md:w-auto"
							leadingIcon={<PlusIcon className="h-4 w-4" />}
							onClick={handleAddPreset}
						>
							{UI_LABELS.NOTE_PRESETS.ADD_BUTTON}
						</ActionButton>
					</div>

					<div className="flex items-center justify-end gap-3 border-t border-border-subtle pt-4">
						<ActionButton
							tone="primary"
							onClick={handleSave}
							busy={feedback.isPending}
							success={feedback.isSuccess}
							disabled={!dirty}
						>
							{feedback.isSuccess ? UI_LABELS.SAVED : UI_LABELS.SAVE}
						</ActionButton>
					</div>
				</fieldset>
			)}
		</SectionCard>
	);
}
