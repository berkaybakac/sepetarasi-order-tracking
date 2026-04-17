import { DELIVERY_TARGET_MAX, DELIVERY_TARGET_MIN } from "@sepetarasi/shared";
import { ActionButton, InlineAlert, NumberStepper } from "../ui/primitives";

export function StatsKpiCard({
	label,
	value,
	badge,
	badgeTone,
}: {
	label: string;
	value: string;
	badge?: string;
	badgeTone: "good" | "bad" | "neutral";
}) {
	const toneClass =
		badgeTone === "good"
			? "text-emerald-200 bg-emerald-500/10 border-emerald-500/25"
			: badgeTone === "bad"
				? "text-rose-200 bg-rose-500/10 border-rose-500/25"
				: "text-slate-200 bg-white/6 border-border-subtle";

	return (
		<div className="flex min-h-[114px] flex-col justify-between rounded-[1.25rem] border border-border-subtle bg-surface-3/90 p-4">
			<p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-subtle">{label}</p>
			<p className="text-[1.8rem] font-semibold tabular-nums text-text-strong md:text-3xl">
				{value}
			</p>
			{badge ? (
				<span
					className={`w-fit rounded-full border px-2 py-1 text-[10px] font-medium ${toneClass}`}
				>
					{badge}
				</span>
			) : (
				<span className="h-5" />
			)}
		</div>
	);
}

export function TargetMinutesEditor({
	value,
	onChange,
	onSave,
	saving,
	dirty,
	error,
	saveLabel,
}: {
	value: number;
	onChange: (value: number) => void;
	onSave: () => void;
	saving: boolean;
	dirty: boolean;
	error: string | null;
	saveLabel: "idle" | "saved";
}) {
	return (
		<div className="w-full rounded-[1.25rem] border border-border-subtle bg-surface-3/90 p-4 xl:min-w-[19rem] xl:max-w-[21rem]">
			<div className="flex flex-col gap-3">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-subtle">
						Teslim Hedefi
					</p>
					<p className="mt-1 text-xs text-text-subtle">
						{DELIVERY_TARGET_MIN}-{DELIVERY_TARGET_MAX} dk
					</p>
				</div>
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
					<div className="flex-1">
						<NumberStepper
							value={value}
							min={DELIVERY_TARGET_MIN}
							max={DELIVERY_TARGET_MAX}
							onChange={onChange}
							decreaseLabel="Teslim hedefini azalt"
							increaseLabel="Teslim hedefini artır"
							inputLabel="Teslim hedefi dakikası"
							disabled={saving}
						/>
					</div>
					<ActionButton
						tone="primary"
						onClick={onSave}
						busy={saving}
						success={saveLabel === "saved"}
						disabled={!dirty}
						className="h-10 min-w-[108px] px-4"
					>
						{saveLabel === "saved" ? "Kaydedildi" : "Kaydet"}
					</ActionButton>
				</div>
			</div>
			{error ? (
				<InlineAlert className="mt-3" tone="danger">
					{error}
				</InlineAlert>
			) : null}
		</div>
	);
}

export function StatsEmptyState({ label, compact = false }: { label: string; compact?: boolean }) {
	return (
		<div
			className={`flex items-center justify-center text-sm text-text-subtle ${
				compact ? "py-6" : "py-16"
			}`}
		>
			{label}
		</div>
	);
}
