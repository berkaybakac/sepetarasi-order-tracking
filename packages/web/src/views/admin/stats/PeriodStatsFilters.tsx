import { PRESETS, type PresetKey } from "./range-utils";

interface Props {
	preset: PresetKey;
	range: { from: string; to: string };
	onPresetChange: (key: PresetKey) => void;
	onCustomChange: (field: "from" | "to", value: string) => void;
}

export function PeriodStatsFilters({ preset, range, onPresetChange, onCustomChange }: Props) {
	return (
		<div className="flex flex-col gap-3 rounded-[1.35rem] border border-border-subtle bg-surface-1/80 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
			<div className="flex flex-wrap items-center gap-2">
				{PRESETS.map((p) => (
					<button
						key={p.key}
						type="button"
						onClick={() => onPresetChange(p.key)}
						className={`rounded-[0.9rem] border px-3 py-1.5 text-sm font-medium transition ${
							preset === p.key
								? "border-brand-primary/25 bg-brand-primary/12 text-text-strong shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
								: "border-border-subtle bg-surface-1 text-text-muted hover:border-white/18 hover:text-text-strong"
						}`}
					>
						{p.label}
					</button>
				))}
			</div>
			<div className="flex flex-wrap items-center gap-2 lg:justify-end">
				<input
					type="date"
					value={range.from}
					max={range.to}
					onChange={(e) => onCustomChange("from", e.target.value)}
					className="h-10 rounded-[0.9rem] border border-border-subtle bg-surface-1 px-3 text-sm text-text-strong"
				/>
				<span className="text-sm text-text-subtle">—</span>
				<input
					type="date"
					value={range.to}
					min={range.from}
					onChange={(e) => onCustomChange("to", e.target.value)}
					className="h-10 rounded-[0.9rem] border border-border-subtle bg-surface-1 px-3 text-sm text-text-strong"
				/>
			</div>
		</div>
	);
}
