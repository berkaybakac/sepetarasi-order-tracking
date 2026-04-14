import {
	DISPLAY_LAYOUT_PREFERENCES,
	DISPLAY_TEXT_SCALES,
	type DisplayLayoutPreference,
	type DisplayTextScale,
} from "@sepetarasi/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { UI_LABELS } from "../../constants/labels";
import { buildDisplayUrl } from "../display/display-url-overrides";
import { LAYOUT_LABELS, TEXT_SCALE_LABELS } from "./display-settings-labels";

interface ScreenSlot {
	id: string;
	name: string;
	layout: DisplayLayoutPreference | "";
	max: string;
	scale: DisplayTextScale | "";
}

export function ScreenUrlBuilderCard({ embedded = false }: { embedded?: boolean }) {
	const slotCounterRef = useRef(0);
	function newSlot(name: string): ScreenSlot {
		return { id: String(++slotCounterRef.current), name, layout: "", max: "", scale: "" };
	}

	const [slots, setSlots] = useState<ScreenSlot[]>(() => [
		newSlot(`${UI_LABELS.SCREEN_URL_BUILDER.DEFAULT_SLOT_PREFIX} 1`),
		newSlot(`${UI_LABELS.SCREEN_URL_BUILDER.DEFAULT_SLOT_PREFIX} 2`),
	]);
	const [copiedId, setCopiedId] = useState<string | null>(null);
	const [copyErrorId, setCopyErrorId] = useState<string | null>(null);
	const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(
		() => () => {
			if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
		},
		[],
	);

	const updateSlot = useCallback((id: string, patch: Partial<ScreenSlot>) => {
		setSlots((prev) => prev.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot)));
	}, []);

	const removeSlot = useCallback((id: string) => {
		setSlots((prev) => prev.filter((slot) => slot.id !== id));
	}, []);

	const addSlot = () =>
		setSlots((prev) => [
			...prev,
			newSlot(`${UI_LABELS.SCREEN_URL_BUILDER.DEFAULT_SLOT_PREFIX} ${prev.length + 1}`),
		]);

	const copyUrl = async (slot: ScreenSlot) => {
		const url = window.location.origin + buildDisplayUrl(slot);
		if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
		try {
			if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
			await navigator.clipboard.writeText(url);
			setCopiedId(slot.id);
			setCopyErrorId(null);
		} catch (err) {
			console.error("[ScreenUrlBuilderCard] copy failed:", err);
			setCopiedId(null);
			setCopyErrorId(slot.id);
		}
		copyTimerRef.current = setTimeout(() => {
			setCopiedId(null);
			setCopyErrorId(null);
		}, 1500);
	};

	const containerClass = embedded
		? "rounded-2xl border border-slate-700/50 bg-slate-900/35 p-4 relative overflow-hidden flex flex-col gap-4"
		: "bg-white/5 backdrop-blur-xl rounded-3xl shadow-lg shadow-black/20 border border-white/5 p-6 relative overflow-hidden group hover:border-white/10 transition-colors flex flex-col gap-4";

	const overlayClass = embedded
		? "absolute inset-0 bg-gradient-to-tr from-violet-500/5 to-blue-500/5 pointer-events-none"
		: "absolute inset-0 bg-gradient-to-tr from-violet-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none";

	return (
		<div className={containerClass}>
			<div className={overlayClass} />

			<div className="relative z-10">
				<h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
					{UI_LABELS.SCREEN_URL_BUILDER.TITLE}
				</h3>
				<p className="text-xs text-slate-500 mt-1">{UI_LABELS.SCREEN_URL_BUILDER.DESCRIPTION}</p>
			</div>

			<div className="relative z-10 flex flex-col gap-3">
				{slots.map((slot) => {
					const url = buildDisplayUrl(slot);
					return (
						<div
							key={slot.id}
							className="rounded-2xl bg-slate-950/40 border border-slate-700/50 p-4 flex flex-col gap-3"
						>
							<div className="flex items-center gap-2">
								<input
									type="text"
									value={slot.name}
									onChange={(e) => updateSlot(slot.id, { name: e.target.value })}
									placeholder={UI_LABELS.SCREEN_URL_BUILDER.SLOT_NAME_PLACEHOLDER}
									className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-700 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-slate-500"
								/>
								{slots.length > 1 && (
									<button
										type="button"
										onClick={() => removeSlot(slot.id)}
										className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
									>
										{UI_LABELS.SCREEN_URL_BUILDER.REMOVE}
									</button>
								)}
							</div>

							<div className="grid grid-cols-3 gap-2">
								<label className="text-xs text-slate-400">
									<span className="block mb-1">{UI_LABELS.SCREEN_URL_BUILDER.LAYOUT_LABEL}</span>
									<select
										className="w-full px-2 py-1.5 rounded-lg bg-slate-900/60 border border-slate-700 text-white text-xs"
										value={slot.layout}
										onChange={(e) =>
											updateSlot(slot.id, {
												layout: e.target.value as DisplayLayoutPreference | "",
											})
										}
									>
										<option value="">{UI_LABELS.SCREEN_URL_BUILDER.GLOBAL_OPTION}</option>
										{DISPLAY_LAYOUT_PREFERENCES.map((layout) => (
											<option key={layout} value={layout}>
												{LAYOUT_LABELS[layout]}
											</option>
										))}
									</select>
								</label>

								<label className="text-xs text-slate-400">
									<span className="block mb-1">{UI_LABELS.SCREEN_URL_BUILDER.MAX_ORDERS_LABEL}</span>
									<input
										type="number"
										min={1}
										placeholder={UI_LABELS.SCREEN_URL_BUILDER.GLOBAL_OPTION}
										value={slot.max}
										onChange={(e) => updateSlot(slot.id, { max: e.target.value })}
										className="number-input-no-spinner w-full px-2 py-1.5 rounded-lg bg-slate-900/60 border border-slate-700 text-white text-xs text-center placeholder:text-slate-600 focus:outline-none"
									/>
								</label>

								<label className="text-xs text-slate-400">
									<span className="block mb-1">{UI_LABELS.SCREEN_URL_BUILDER.TEXT_SCALE_LABEL}</span>
									<select
										className="w-full px-2 py-1.5 rounded-lg bg-slate-900/60 border border-slate-700 text-white text-xs"
										value={slot.scale}
										onChange={(e) =>
											updateSlot(slot.id, { scale: e.target.value as DisplayTextScale | "" })
										}
									>
										<option value="">{UI_LABELS.SCREEN_URL_BUILDER.GLOBAL_OPTION}</option>
										{DISPLAY_TEXT_SCALES.map((scale) => (
											<option key={scale} value={scale}>
												{TEXT_SCALE_LABELS[scale]}
											</option>
										))}
									</select>
								</label>
							</div>

							<div className="flex items-center gap-2">
								<code className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-300 text-xs font-mono truncate">
									{url}
								</code>
								<button
									type="button"
									onClick={() => copyUrl(slot)}
									className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/60 hover:bg-slate-700/70 text-slate-100 border border-slate-600/40 transition-all"
								>
									{copiedId === slot.id
										? UI_LABELS.SCREEN_URL_BUILDER.COPIED
										: copyErrorId === slot.id
											? UI_LABELS.SCREEN_URL_BUILDER.COPY_ERROR
											: UI_LABELS.SCREEN_URL_BUILDER.COPY}
								</button>
							</div>
						</div>
					);
				})}
			</div>

			<div className="relative z-10">
				<button
					type="button"
					onClick={addSlot}
					className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 border border-slate-700/50 transition-all"
				>
					{UI_LABELS.SCREEN_URL_BUILDER.ADD_SCREEN}
				</button>
			</div>
		</div>
	);
}
