export type PresetKey = "today" | "yesterday" | "last7" | "last30" | "custom";

export interface PresetRange {
	key: PresetKey;
	label: string;
}

export const PRESETS: PresetRange[] = [
	{ key: "today", label: "Bugün" },
	{ key: "yesterday", label: "Dün" },
	{ key: "last7", label: "Son 7 Gün" },
	{ key: "last30", label: "Son 30 Gün" },
	{ key: "custom", label: "Özel" },
];

export function toIsoDate(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

export function rangeForPreset(key: PresetKey): { from: string; to: string } {
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
	const d = new Date(`${bucket}T00:00:00`);
	if (Number.isNaN(d.getTime())) return bucket;
	return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}
