import { parseNotePresets, serializeNotePresets } from "@sepetarasi/shared";
import { useCallback, useEffect, useState } from "react";
import { CloseIcon, NotesIcon, PlusIcon } from "../../components/icons";
import { UI_LABELS } from "../../constants/labels";
import { useActionFeedback } from "../../hooks/useActionFeedback";
import { ApiError, api } from "../../lib/api";
import { logger } from "../../lib/logger";
import { ActionButton, InlineAlert, SectionCard, SkeletonBlock, TextInput } from "./ui/primitives";

function getNotePresetsLoadErrorMessage(error: unknown) {
	if (error instanceof ApiError) {
		if (error.code === "UNAUTHORIZED") {
			return UI_LABELS.NOTE_PRESETS.LOAD_AUTH_ERROR;
		}

		if (error.code === "NETWORK_ERROR" || error.code === "TIMEOUT" || error.code === "ABORTED") {
			return UI_LABELS.NOTE_PRESETS.LOAD_NETWORK_ERROR;
		}
	}

	return UI_LABELS.NOTE_PRESETS.LOAD_ERROR;
}

export function NotePresetsCard() {
	const [presets, setPresets] = useState<string[]>([]);
	const [savedPresets, setSavedPresets] = useState<string[]>([]);
	const [newPreset, setNewPreset] = useState("");
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const feedback = useActionFeedback();

	const loadPresets = useCallback(async () => {
		setLoading(true);
		setLoadError(null);

		try {
			const settings = await api.getPublicSettings();
			const parsed = parseNotePresets(settings);
			setPresets(parsed);
			setSavedPresets(parsed);
		} catch (error) {
			logger.error("NotePresetsCard", "Failed to load note presets.", error);
			setLoadError(getNotePresetsLoadErrorMessage(error));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadPresets();
	}, [loadPresets]);

	const remainingCharacters = Math.max(0, 50 - newPreset.length);

	const persistPresets = useCallback(
		async (
			nextPresets: string[],
			options?: {
				successMessage?: string;
				restoreInputValue?: string;
			},
		) => {
			const rollbackPresets = savedPresets;
			setPresets(nextPresets);
			feedback.setPending(UI_LABELS.NOTE_PRESETS.SAVING);

			try {
				await api.updateSettingsBulk(serializeNotePresets(nextPresets));
				setSavedPresets(nextPresets);
				feedback.setSuccess(options?.successMessage ?? UI_LABELS.SAVED);
			} catch (error) {
				setPresets(rollbackPresets);
				if (options?.restoreInputValue !== undefined) {
					setNewPreset(options.restoreInputValue);
				}
				logger.error("NotePresetsCard", "Failed to save note presets.", error);
				feedback.setError(error, UI_LABELS.NOTE_PRESETS.SAVE_ERROR);
			}
		},
		[feedback, savedPresets],
	);

	const handleAddPreset = async () => {
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
			feedback.setError(
				new Error(UI_LABELS.NOTE_PRESETS.DUPLICATE_ERROR),
				UI_LABELS.NOTE_PRESETS.DUPLICATE_ERROR,
			);
			return;
		}

		setNewPreset("");
		feedback.reset();
		await persistPresets([...presets, trimmed], {
			successMessage: UI_LABELS.NOTE_PRESETS.ADD_SUCCESS,
			restoreInputValue: trimmed,
		});
	};

	const handleRemovePreset = async (idx: number) => {
		feedback.reset();
		await persistPresets(
			presets.filter((_, i) => i !== idx),
			{ successMessage: UI_LABELS.NOTE_PRESETS.REMOVE_SUCCESS },
		);
	};

	return (
		<SectionCard
			title={UI_LABELS.NOTE_PRESETS.TITLE}
			icon={<NotesIcon className="h-4 w-4" />}
			actions={
				loading || loadError ? null : (
					<span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-xs font-semibold text-text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
						<span className="h-1.5 w-1.5 rounded-full bg-brand-primary shadow-[0_0_10px_rgba(34,211,238,0.85)]" />
						{presets.length} / 20
					</span>
				)
			}
		>
			{loading ? (
				<div className="space-y-4">
					<SkeletonBlock className="h-11 w-full" />
					<SkeletonBlock className="h-24 w-full" />
					<SkeletonBlock className="h-24 w-full" />
				</div>
			) : loadError ? (
				<div className="space-y-4">
					<InlineAlert tone="danger">{loadError}</InlineAlert>
					<div className="flex justify-end">
						<ActionButton tone="secondary" onClick={() => void loadPresets()}>
							{UI_LABELS.NOTE_PRESETS.RETRY_BUTTON}
						</ActionButton>
					</div>
				</div>
			) : (
				<fieldset
					disabled={feedback.isPending}
					className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.92fr)]"
				>
					{feedback.isError && feedback.message ? (
						<InlineAlert tone="danger" className="xl:col-span-2">
							{feedback.message}
						</InlineAlert>
					) : null}
					{feedback.isPending && feedback.message ? (
						<InlineAlert tone="info" className="xl:col-span-2">
							{feedback.message}
						</InlineAlert>
					) : null}
					{feedback.isSuccess && feedback.message ? (
						<InlineAlert tone="success" className="xl:col-span-2">
							{feedback.message}
						</InlineAlert>
					) : null}

					<div className="rounded-[1.35rem] border border-border-subtle bg-surface-1/45 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
						<div className="mb-4 flex items-center justify-between gap-3">
							<div>
								<p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-brand-primary/90">
									Aktif Liste
								</p>
								<p className="mt-1 text-sm text-text-subtle">Kasada görünen hazır notlar</p>
							</div>
						</div>

						{presets.length === 0 ? (
							<div className="rounded-[1.1rem] border border-dashed border-border-strong bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_55%)] px-5 py-7 text-center">
								<div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-brand-primary shadow-[0_10px_30px_rgba(34,211,238,0.08)]">
									<NotesIcon className="h-5 w-5" />
								</div>
								<p className="text-base font-semibold text-text-strong">
									{UI_LABELS.NOTE_PRESETS.EMPTY_STATE}
								</p>
								<p className="mt-2 text-sm text-text-subtle">
									{UI_LABELS.NOTE_PRESETS.EMPTY_STATE_HINT}
								</p>
							</div>
						) : (
							<div className="grid max-h-[26rem] gap-3 overflow-y-auto pr-1 md:grid-cols-2 2xl:grid-cols-3">
								{presets.map((preset, idx) => (
									<div
										key={preset}
										className="group relative overflow-hidden rounded-[1.15rem] border border-white/8 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] p-4 shadow-[0_18px_32px_rgba(3,7,18,0.16)] transition duration-200 hover:border-cyan-300/18 hover:shadow-[0_22px_38px_rgba(8,145,178,0.12)]"
									>
										<div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
										<div className="mb-4 flex items-center justify-between gap-3">
											<span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-cyan-400/18 bg-cyan-400/10 px-2 text-[0.68rem] font-semibold tracking-[0.18em] text-cyan-100">
												{String(idx + 1).padStart(2, "0")}
											</span>
											<button
												type="button"
												className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-transparent text-text-muted transition hover:border-white/10 hover:bg-white/8 hover:text-text-strong"
												onClick={() => void handleRemovePreset(idx)}
												aria-label={`${preset} notunu sil`}
											>
												<CloseIcon className="h-3.5 w-3.5" />
												<span className="sr-only">{UI_LABELS.NOTE_PRESETS.REMOVE_BUTTON}</span>
											</button>
										</div>
										<button
											type="button"
											className="block w-full text-left"
											onClick={() => {
												setNewPreset(preset);
												feedback.reset();
											}}
											aria-label={`${preset} notunu düzenlemek için alana taşı`}
										>
											<p className="min-w-0 break-words text-[1.02rem] font-semibold leading-6 text-text-strong [overflow-wrap:anywhere] [word-break:break-word]">
												{preset}
											</p>
											<div className="mt-4 flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-text-subtle">
												<span className="h-1.5 w-1.5 rounded-full bg-brand-primary/80" />
												Hazır not
											</div>
										</button>
									</div>
								))}
							</div>
						)}
					</div>

					<div className="relative overflow-hidden rounded-[1.4rem] border border-cyan-400/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 shadow-[0_20px_45px_rgba(8,145,178,0.10)]">
						<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.12),transparent_34%)]" />
						<div className="relative z-10">
							<div className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.06] text-brand-primary shadow-[0_12px_30px_rgba(34,211,238,0.10)]">
								<PlusIcon className="h-5 w-5" />
							</div>
							<p className="mt-5 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-brand-primary/90">
								Yeni Hazır Not
							</p>
							<h3 className="mt-2 text-[1.35rem] font-semibold leading-8 tracking-tight text-text-strong">
								Kasaya hızlı bir seçenek ekle
							</h3>

							<div className="mt-5 space-y-3">
								<TextInput
									id="note-preset-input"
									type="text"
									aria-label={UI_LABELS.NOTE_PRESETS.INPUT_LABEL}
									placeholder={UI_LABELS.NOTE_PRESETS.PLACEHOLDER}
									value={newPreset}
									onChange={(event) => setNewPreset(event.target.value)}
									onKeyDown={(event) => {
										if (event.key === "Enter") {
											event.preventDefault();
											void handleAddPreset();
										}
									}}
									maxLength={50}
									className="h-[3.25rem] border-white/10 bg-slate-950/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] placeholder:text-text-subtle/80"
								/>

								<div className="flex items-center justify-between gap-3">
									<p className="text-xs font-medium text-text-subtle">
										{remainingCharacters} karakter kaldı
									</p>
									<ActionButton
										tone="primary"
										className="h-12 min-w-[11rem] px-5"
										leadingIcon={<PlusIcon className="h-4 w-4" />}
										onClick={() => void handleAddPreset()}
										busy={feedback.isPending}
									>
										{UI_LABELS.NOTE_PRESETS.ADD_BUTTON}
									</ActionButton>
								</div>
							</div>
						</div>
					</div>
				</fieldset>
			)}
		</SectionCard>
	);
}
