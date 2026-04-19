import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "../../../lib/cn";
import { ActionButton } from "../ui/primitives";
import {
	type DateRange,
	PRESETS,
	type PresetKey,
	WEEKDAY_LABELS,
	buildCalendarDays,
	compareIsoDates,
	formatDisplayDate,
	formatLongDate,
	formatMonthLabel,
	formatRangeLabel,
	isIsoDateInRange,
	normalizeRange,
	parseIsoDate,
	rangeForCurrentMonth,
	rangeForCurrentWeek,
	rangeForPreviousMonth,
	rangeForPreviousWeek,
	shiftMonth,
	toIsoDate,
} from "./range-utils";

interface Props {
	preset: PresetKey;
	range: DateRange;
	onPresetChange: (key: PresetKey) => void;
	onCustomChange: (range: DateRange) => void;
}

const INLINE_PRESETS = PRESETS.filter((preset) => preset.key !== "custom");

const CALENDAR_SHORTCUTS = [
	{ label: "Bu Hafta", resolve: rangeForCurrentWeek },
	{ label: "Geçen Hafta", resolve: rangeForPreviousWeek },
	{ label: "Bu Ay", resolve: rangeForCurrentMonth },
	{ label: "Geçen Ay", resolve: rangeForPreviousMonth },
];

type SelectionPhase = "from" | "to";

interface CalendarMonthProps {
	month: Date;
	range: DateRange;
	todayIso: string;
	onSelectDay: (iso: string) => void;
}

function CalendarMonth({ month, range, todayIso, onSelectDay }: CalendarMonthProps) {
	const days = buildCalendarDays(month);

	return (
		<div className="rounded-[1.15rem] border border-border-subtle bg-surface-3/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
			<h4 className="text-sm font-semibold capitalize text-text-strong">
				{formatMonthLabel(month)}
			</h4>
			<div className="mt-3 grid grid-cols-7 gap-1 text-center text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-text-subtle">
				{WEEKDAY_LABELS.map((label) => (
					<span key={label}>{label}</span>
				))}
			</div>
			<div className="mt-2 grid grid-cols-7 gap-1">
				{days.map((day) => {
					const isStart = day.iso === range.from;
					const isEnd = day.iso === range.to;
					const isEdge = isStart || isEnd;
					const inRange = isIsoDateInRange(day.iso, range);
					const isToday = day.iso === todayIso;

					return (
						<button
							key={day.iso}
							type="button"
							data-date={day.iso}
							aria-label={formatLongDate(day.iso)}
							onClick={() => onSelectDay(day.iso)}
							className={cn(
								"relative flex h-10 items-center justify-center rounded-[0.85rem] text-sm transition duration-150",
								day.inCurrentMonth ? "text-text-strong" : "text-text-subtle/45",
								day.isWeekend && day.inCurrentMonth ? "text-text-muted" : "",
								!inRange && "hover:bg-white/8 hover:text-text-strong",
								inRange && !isEdge && "bg-brand-primary/12 text-text-strong",
								isEdge &&
									"bg-brand-primary text-slate-950 shadow-[0_12px_30px_rgba(14,165,233,0.24)]",
								isToday && !isEdge && "ring-1 ring-brand-primary/40",
							)}
						>
							{day.dayOfMonth}
						</button>
					);
				})}
			</div>
		</div>
	);
}

export function PeriodStatsFilters({ preset, range, onPresetChange, onCustomChange }: Props) {
	const [open, setOpen] = useState(false);
	const [draftRange, setDraftRange] = useState<DateRange>(range);
	const [selectionPhase, setSelectionPhase] = useState<SelectionPhase>("from");
	const [viewMonth, setViewMonth] = useState(() => parseIsoDate(range.from));
	const rootRef = useRef<HTMLDivElement | null>(null);
	const dialogId = useId();
	const todayIso = toIsoDate(new Date());
	const activePresetLabel = PRESETS.find((item) => item.key === preset)?.label ?? "Özel aralık";

	const syncDraft = useCallback((nextRange: DateRange) => {
		setDraftRange(nextRange);
		setSelectionPhase("from");
		setViewMonth(parseIsoDate(nextRange.from));
	}, []);

	useEffect(() => {
		if (open) return;
		syncDraft(range);
	}, [open, range, syncDraft]);

	useEffect(() => {
		if (!open) return;

		const handlePointerDown = (event: MouseEvent) => {
			if (rootRef.current?.contains(event.target as Node)) return;
			setOpen(false);
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};

		document.addEventListener("mousedown", handlePointerDown);
		document.addEventListener("keydown", handleKeyDown);

		return () => {
			document.removeEventListener("mousedown", handlePointerDown);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [open]);

	const handleTogglePicker = () => {
		if (open) {
			setOpen(false);
			return;
		}
		syncDraft(range);
		setOpen(true);
	};

	const handleSelectDay = (iso: string) => {
		if (selectionPhase === "from") {
			setDraftRange((current) => ({
				from: iso,
				to: compareIsoDates(iso, current.to) > 0 ? iso : current.to,
			}));
			setSelectionPhase("to");
			return;
		}

		setDraftRange((current) => normalizeRange({ from: current.from, to: iso }));
		setSelectionPhase("from");
	};

	const applyCustomRange = (nextRange: DateRange) => {
		onCustomChange(normalizeRange(nextRange));
		setOpen(false);
	};

	return (
		<div className="flex flex-col gap-3 rounded-[1.35rem] border border-border-subtle bg-surface-1/80 px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
			<div className="flex flex-wrap items-center gap-2">
				{INLINE_PRESETS.map((item) => (
					<button
						key={item.key}
						type="button"
						onClick={() => {
							setOpen(false);
							onPresetChange(item.key);
						}}
						className={cn(
							"rounded-[0.9rem] border px-3 py-1.5 text-sm font-medium transition",
							preset === item.key
								? "border-brand-primary/25 bg-brand-primary/12 text-text-strong shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
								: "border-border-subtle bg-surface-1 text-text-muted hover:border-white/18 hover:text-text-strong",
						)}
					>
						{item.label}
					</button>
				))}
			</div>

			<div ref={rootRef} className="relative w-full lg:w-auto">
				<button
					type="button"
					aria-label="Tarih aralığını seç"
					aria-haspopup="dialog"
					aria-expanded={open}
					aria-controls={dialogId}
					onClick={handleTogglePicker}
					className={cn(
						"flex w-full min-w-0 flex-col rounded-[1.05rem] border px-4 py-3 text-left transition lg:min-w-[21rem]",
						open || preset === "custom"
							? "border-brand-primary/28 bg-brand-primary/10 shadow-[0_14px_35px_rgba(14,165,233,0.12)]"
							: "border-border-subtle bg-surface-1 hover:border-white/18 hover:bg-surface-1/90",
					)}
				>
					<span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-text-subtle">
						Tarih Aralığı
					</span>
					<span className="mt-1 text-sm font-semibold text-text-strong">
						{formatRangeLabel(range)}
					</span>
					<span className="mt-1 text-xs text-text-subtle">
						{preset === "custom" ? "Özel seçim" : activePresetLabel}
					</span>
				</button>

				{open ? (
						<dialog
							id={dialogId}
							open
							aria-label="Özel tarih aralığı seçici"
							aria-modal="false"
							className="absolute left-0 top-[calc(100%+0.75rem)] z-30 max-h-[calc(100dvh-6rem)] w-[calc(100vw-2rem)] max-w-[54rem] overflow-auto overscroll-contain rounded-[1.4rem] border border-border-subtle bg-surface-2/98 p-4 shadow-[0_28px_80px_rgba(3,9,20,0.55)] backdrop-blur-xl sm:left-auto sm:right-0"
						>
						<div className="grid gap-4 xl:grid-cols-[12rem_minmax(0,1fr)]">
							<div className="rounded-[1.15rem] border border-border-subtle bg-surface-3/75 p-3">
								<p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-text-subtle">
									Hızlı Seçimler
								</p>
								<div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-1">
									{CALENDAR_SHORTCUTS.map((shortcut) => (
										<button
											key={shortcut.label}
											type="button"
											onClick={() => applyCustomRange(shortcut.resolve())}
											className="rounded-[0.9rem] border border-border-subtle bg-surface-1 px-3 py-2 text-sm font-medium text-text-muted transition hover:border-white/18 hover:text-text-strong"
										>
											{shortcut.label}
										</button>
									))}
								</div>
								<p className="mt-3 text-xs leading-5 text-text-subtle">
									Bir kez tıklayıp başlangıcı, ikinci kez tıklayıp bitişi seç.
								</p>
							</div>

							<div className="space-y-4">
								<div className="flex flex-col gap-3 rounded-[1.15rem] border border-border-subtle bg-surface-3/75 p-3">
									<div className="flex flex-wrap items-center justify-between gap-2">
										<div>
											<p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-text-subtle">
												Seçim
											</p>
											<p className="mt-1 text-sm text-text-muted">
												{selectionPhase === "from"
													? "Takvimde başlangıç gününü seç."
													: "Takvimde bitiş gününü seç."}
											</p>
										</div>
										<div className="flex items-center gap-2">
											<button
												type="button"
												aria-label="Önceki ay"
												onClick={() => setViewMonth((current) => shiftMonth(current, -1))}
												className="flex h-9 w-9 items-center justify-center rounded-[0.85rem] border border-border-subtle bg-surface-1 text-text-muted transition hover:border-white/18 hover:text-text-strong"
											>
												<svg
													width="16"
													height="16"
													viewBox="0 0 16 16"
													fill="none"
													aria-hidden="true"
												>
													<path
														d="M10 12L6 8l4-4"
														stroke="currentColor"
														strokeWidth="1.75"
														strokeLinecap="round"
														strokeLinejoin="round"
													/>
												</svg>
											</button>
											<button
												type="button"
												aria-label="Sonraki ay"
												onClick={() => setViewMonth((current) => shiftMonth(current, 1))}
												className="flex h-9 w-9 items-center justify-center rounded-[0.85rem] border border-border-subtle bg-surface-1 text-text-muted transition hover:border-white/18 hover:text-text-strong"
											>
												<svg
													width="16"
													height="16"
													viewBox="0 0 16 16"
													fill="none"
													aria-hidden="true"
												>
													<path
														d="M6 4l4 4-4 4"
														stroke="currentColor"
														strokeWidth="1.75"
														strokeLinecap="round"
														strokeLinejoin="round"
													/>
												</svg>
											</button>
										</div>
									</div>

									<div className="grid gap-2 sm:grid-cols-2">
										<button
											type="button"
											onClick={() => setSelectionPhase("from")}
											className={cn(
												"rounded-[0.95rem] border px-3 py-2 text-left transition",
												selectionPhase === "from"
													? "border-brand-primary/28 bg-brand-primary/12"
													: "border-border-subtle bg-surface-1 hover:border-white/18",
											)}
										>
											<span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-text-subtle">
												Başlangıç
											</span>
											<span className="mt-1 block text-sm font-semibold text-text-strong">
												{formatDisplayDate(draftRange.from)}
											</span>
										</button>
										<button
											type="button"
											onClick={() => setSelectionPhase("to")}
											className={cn(
												"rounded-[0.95rem] border px-3 py-2 text-left transition",
												selectionPhase === "to"
													? "border-brand-primary/28 bg-brand-primary/12"
													: "border-border-subtle bg-surface-1 hover:border-white/18",
											)}
										>
											<span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-text-subtle">
												Bitiş
											</span>
											<span className="mt-1 block text-sm font-semibold text-text-strong">
												{formatDisplayDate(draftRange.to)}
											</span>
										</button>
									</div>
								</div>

								<div className="grid gap-3 lg:grid-cols-2">
									<CalendarMonth
										month={viewMonth}
										range={draftRange}
										todayIso={todayIso}
										onSelectDay={handleSelectDay}
									/>
									<CalendarMonth
										month={shiftMonth(viewMonth, 1)}
										range={draftRange}
										todayIso={todayIso}
										onSelectDay={handleSelectDay}
									/>
								</div>

								<div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.15rem] border border-border-subtle bg-surface-3/75 p-3">
									<div>
										<p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-text-subtle">
											Seçilen Aralık
										</p>
										<p className="mt-1 text-sm font-semibold text-text-strong">
											{formatRangeLabel(draftRange)}
										</p>
									</div>
									<div className="flex flex-wrap items-center gap-2">
										<ActionButton
											tone="ghost"
											className="h-10 rounded-[0.95rem] px-3"
											onClick={() => setOpen(false)}
										>
											Vazgeç
										</ActionButton>
										<ActionButton
											tone="primary"
											className="h-10 rounded-[0.95rem] px-3"
											onClick={() => applyCustomRange(draftRange)}
										>
											Uygula
										</ActionButton>
									</div>
								</div>
							</div>
						</div>
					</dialog>
				) : null}
			</div>
		</div>
	);
}
