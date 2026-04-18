export type PresetKey = "today" | "yesterday" | "last7" | "last30" | "custom";

export interface PresetRange {
	key: PresetKey;
	label: string;
}

export interface DateRange {
	from: string;
	to: string;
}

export interface CalendarDay {
	iso: string;
	dayOfMonth: number;
	inCurrentMonth: boolean;
	isWeekend: boolean;
}

export const PRESETS: PresetRange[] = [
	{ key: "today", label: "Bugün" },
	{ key: "yesterday", label: "Dün" },
	{ key: "last7", label: "Son 7 Gün" },
	{ key: "last30", label: "Son 30 Gün" },
	{ key: "custom", label: "Özel" },
];

export const WEEKDAY_LABELS = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pa"];

const DISPLAY_DATE_FORMATTER = new Intl.DateTimeFormat("tr-TR", {
	day: "2-digit",
	month: "short",
	year: "numeric",
});

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("tr-TR", {
	day: "numeric",
	month: "long",
	year: "numeric",
});

const MONTH_FORMATTER = new Intl.DateTimeFormat("tr-TR", {
	month: "long",
	year: "numeric",
});

export function toIsoDate(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

export function parseIsoDate(value: string): Date {
	const [year, month, day] = value.split("-").map(Number);
	return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function compareIsoDates(left: string, right: string): number {
	if (left === right) return 0;
	return left < right ? -1 : 1;
}

export function normalizeRange(range: DateRange): DateRange {
	return compareIsoDates(range.from, range.to) <= 0 ? range : { from: range.to, to: range.from };
}

function addDays(date: Date, amount: number): Date {
	const next = new Date(date);
	next.setDate(next.getDate() + amount);
	return next;
}

function addMonths(date: Date, amount: number): Date {
	return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function startOfWeek(date: Date): Date {
	const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	const dayIndex = (start.getDay() + 6) % 7;
	start.setDate(start.getDate() - dayIndex);
	return start;
}

function startOfMonth(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function shiftMonth(month: Date, amount: number): Date {
	return addMonths(month, amount);
}

export function buildCalendarDays(month: Date): CalendarDay[] {
	const firstDay = startOfMonth(month);
	const leadingDays = (firstDay.getDay() + 6) % 7;
	const cursor = addDays(firstDay, -leadingDays);
	const cells: CalendarDay[] = [];

	for (let index = 0; index < 42; index += 1) {
		const cellDate = addDays(cursor, index);
		cells.push({
			iso: toIsoDate(cellDate),
			dayOfMonth: cellDate.getDate(),
			inCurrentMonth: cellDate.getMonth() === month.getMonth(),
			isWeekend: cellDate.getDay() === 0 || cellDate.getDay() === 6,
		});
	}

	return cells;
}

export function isIsoDateInRange(iso: string, range: DateRange): boolean {
	return compareIsoDates(iso, range.from) >= 0 && compareIsoDates(iso, range.to) <= 0;
}

export function formatDisplayDate(value: string): string {
	return DISPLAY_DATE_FORMATTER.format(parseIsoDate(value));
}

export function formatLongDate(value: string): string {
	return LONG_DATE_FORMATTER.format(parseIsoDate(value));
}

export function formatMonthLabel(month: Date): string {
	return MONTH_FORMATTER.format(month);
}

export function formatRangeLabel(range: DateRange): string {
	return range.from === range.to
		? formatDisplayDate(range.from)
		: `${formatDisplayDate(range.from)} - ${formatDisplayDate(range.to)}`;
}

export function rangeForPreset(key: PresetKey): DateRange {
	const now = new Date();
	const today = toIsoDate(now);
	if (key === "today") return { from: today, to: today };
	if (key === "yesterday") {
		const y = new Date(now);
		y.setDate(y.getDate() - 1);
		const iso = toIsoDate(y);
		return { from: iso, to: iso };
	}
	if (key === "last7") {
		const from = new Date(now);
		from.setDate(from.getDate() - 6);
		return { from: toIsoDate(from), to: today };
	}
	if (key === "last30") {
		const from = new Date(now);
		from.setDate(from.getDate() - 29);
		return { from: toIsoDate(from), to: today };
	}
	return { from: today, to: today };
}

export function rangeForCurrentWeek(): DateRange {
	const today = new Date();
	return { from: toIsoDate(startOfWeek(today)), to: toIsoDate(today) };
}

export function rangeForPreviousWeek(): DateRange {
	const currentWeekStart = startOfWeek(new Date());
	const previousWeekStart = addDays(currentWeekStart, -7);
	return { from: toIsoDate(previousWeekStart), to: toIsoDate(addDays(previousWeekStart, 6)) };
}

export function rangeForCurrentMonth(): DateRange {
	const today = new Date();
	return { from: toIsoDate(startOfMonth(today)), to: toIsoDate(today) };
}

export function rangeForPreviousMonth(): DateRange {
	const previousMonth = addMonths(new Date(), -1);
	return {
		from: toIsoDate(startOfMonth(previousMonth)),
		to: toIsoDate(endOfMonth(previousMonth)),
	};
}

export function formatBucket(bucket: string, granularity: "hour" | "day"): string {
	if (granularity === "hour") {
		// Hour granularity 2 güne kadar yayılabilir; gün bilgisi olmadan 14:00 iki güne denk gelirse label çakışır.
		const match = bucket.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):/);
		if (!match) return bucket;
		const [, day, hour] = match;
		const d = new Date(`${day}T00:00:00`);
		if (Number.isNaN(d.getTime())) return `${hour}:00`;
		const dayLabel = d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
		return `${dayLabel} ${hour}:00`;
	}
	const d = parseIsoDate(bucket);
	if (Number.isNaN(d.getTime())) return bucket;
	return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}
