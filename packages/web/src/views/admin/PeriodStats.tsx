import {
	DELIVERY_TARGET_DEFAULT_MINUTES,
	DELIVERY_TARGET_MAX,
	DELIVERY_TARGET_MIN,
	SETTING_KEYS,
} from "@sepetarasi/shared";
import type { DeliveryAnalyticsResult } from "@sepetarasi/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	CartesianGrid,
	Line,
	LineChart,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { api } from "../../lib/api";
import { useSettingsStore } from "../../stores/settingsStore";

type PresetKey = "today" | "yesterday" | "last7" | "last30" | "custom";

interface PresetRange {
	key: PresetKey;
	label: string;
}

const PRESETS: PresetRange[] = [
	{ key: "today", label: "Bugün" },
	{ key: "yesterday", label: "Dün" },
	{ key: "last7", label: "Son 7 Gün" },
	{ key: "last30", label: "Son 30 Gün" },
	{ key: "custom", label: "Özel" },
];

function toIsoDate(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function rangeForPreset(key: PresetKey): { from: string; to: string } {
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

function clampInt(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function formatBucket(bucket: string, granularity: "hour" | "day"): string {
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

interface Props {
	wsTrigger?: number;
	reconnectedAt?: number;
}

export function PeriodStats({ wsTrigger, reconnectedAt }: Props) {
	const deliveryTargetMinutes = useSettingsStore((s) => s.deliveryTargetMinutes);
	const hydrateSettings = useSettingsStore((s) => s.hydrate);
	const setDeliveryTargetMinutes = useSettingsStore((s) => s.setDeliveryTargetMinutes);
	const [preset, setPreset] = useState<PresetKey>("last7");
	const [range, setRange] = useState<{ from: string; to: string }>(() => rangeForPreset("last7"));
	const [analytics, setAnalytics] = useState<DeliveryAnalyticsResult | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [targetDraft, setTargetDraft] = useState(deliveryTargetMinutes);
	const [targetSaving, setTargetSaving] = useState(false);
	const [targetError, setTargetError] = useState<string | null>(null);
	const [targetSaveLabel, setTargetSaveLabel] = useState<"idle" | "saved">("idle");
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Son senkron edilen server değeri. Draft ile karşılaştırıp kullanıcının dirty edit'ini WS override'dan koruyoruz.
	const lastSyncedTargetRef = useRef(deliveryTargetMinutes);

	const fetchAnalytics = useCallback(async (from: string, to: string, silent = false) => {
		if (!silent) setLoading(true);
		setError(null);
		try {
			const data = await api.getDeliveryAnalytics(from, to);
			setAnalytics(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Veri alınamadı");
		} finally {
			if (!silent) setLoading(false);
		}
	}, []);

	useEffect(
		() => () => {
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
		},
		[],
	);

	useEffect(() => {
		// Draft son senkron değerle aynıysa kullanıcı dirty değil, WS hydrate'i uygula.
		// Aksi halde (user editing) draft'ı olduğu gibi bırak — başka admin kaydetse bile silmesin.
		setTargetDraft((current) =>
			current === lastSyncedTargetRef.current ? deliveryTargetMinutes : current,
		);
		lastSyncedTargetRef.current = deliveryTargetMinutes;
	}, [deliveryTargetMinutes]);

	useEffect(() => {
		fetchAnalytics(range.from, range.to);
	}, [range, fetchAnalytics]);

	useEffect(() => {
		if (wsTrigger) fetchAnalytics(range.from, range.to, true);
	}, [wsTrigger, range, fetchAnalytics]);

	useEffect(() => {
		if (reconnectedAt) fetchAnalytics(range.from, range.to, true);
	}, [reconnectedAt, range, fetchAnalytics]);

	const handlePreset = (key: PresetKey) => {
		setPreset(key);
		if (key !== "custom") setRange(rangeForPreset(key));
	};

	const handleCustomChange = (field: "from" | "to", value: string) => {
		setPreset("custom");
		setRange((prev) => ({ ...prev, [field]: value }));
	};

	const handleTargetDraftChange = (nextValue: number) => {
		setTargetDraft(clampInt(nextValue, DELIVERY_TARGET_MIN, DELIVERY_TARGET_MAX));
		setTargetError(null);
	};

	const handleSaveTarget = async () => {
		setTargetSaving(true);
		setTargetError(null);
		setTargetSaveLabel("idle");

		try {
			await api.updateSetting(SETTING_KEYS.DELIVERY_TARGET_MINUTES, String(targetDraft));
			setDeliveryTargetMinutes(targetDraft);
			await hydrateSettings();
			await fetchAnalytics(range.from, range.to, true);
			setTargetSaveLabel("saved");
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
			saveTimerRef.current = setTimeout(() => setTargetSaveLabel("idle"), 2000);
		} catch (err) {
			setTargetError(err instanceof Error ? err.message : "Teslim hedefi kaydedilemedi.");
		} finally {
			setTargetSaving(false);
		}
	};

	const chartData = useMemo(() => {
		if (!analytics) return [];
		return analytics.timeSeries.points.map((p) => ({
			label: formatBucket(p.bucket, analytics.timeSeries.granularity),
			dk: p.averageDeliveryMinutes,
			count: p.deliveredCount,
		}));
	}, [analytics]);

	const summary = analytics?.summary;
	const targetMinutes =
		summary?.targetMinutes ?? deliveryTargetMinutes ?? DELIVERY_TARGET_DEFAULT_MINUTES;
	const trendPositive = summary ? summary.trendPercent < 0 : false;
	const onTargetOk = summary ? summary.onTargetRate >= 80 : false;
	const maxDistribution = Math.max(1, ...(analytics?.distribution.map((d) => d.count) ?? [1]));
	const empty = !loading && summary != null && summary.totalDelivered === 0;
	const targetDirty = targetDraft !== deliveryTargetMinutes;

	return (
		<div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/5 p-6 space-y-6">
			<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
				<div>
					<h2 className="text-xl font-semibold text-white">Ortalama Teslim Süresi</h2>
					<p className="text-sm text-slate-400">
						Hedef: <span className="text-slate-200 font-medium">{targetMinutes} dk</span>{" "}
						<span className="text-slate-500">
							Canlı uyarılar ve grafik bu hedefe göre hesaplanır.
						</span>
					</p>
				</div>
				<TargetMinutesEditor
					value={targetDraft}
					onChange={handleTargetDraftChange}
					onSave={handleSaveTarget}
					saving={targetSaving}
					dirty={targetDirty}
					error={targetError}
					saveLabel={targetSaveLabel}
				/>
			</div>

			<div className="flex flex-wrap items-center gap-2">
				{PRESETS.map((p) => (
					<button
						key={p.key}
						type="button"
						onClick={() => handlePreset(p.key)}
						className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
							preset === p.key
								? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/20"
								: "text-slate-300 bg-slate-900/50 border border-white/5 hover:border-white/20"
						}`}
					>
						{p.label}
					</button>
				))}
				<div className="flex items-center gap-2 ml-auto">
					<input
						type="date"
						value={range.from}
						max={range.to}
						onChange={(e) => handleCustomChange("from", e.target.value)}
						className="bg-slate-900/70 border border-white/10 text-slate-100 rounded-lg px-3 py-1.5 text-sm"
					/>
					<span className="text-slate-500 text-sm">—</span>
					<input
						type="date"
						value={range.to}
						min={range.from}
						onChange={(e) => handleCustomChange("to", e.target.value)}
						className="bg-slate-900/70 border border-white/10 text-slate-100 rounded-lg px-3 py-1.5 text-sm"
					/>
				</div>
			</div>

			{error && (
				<div className="bg-rose-500/10 border border-rose-500/40 text-rose-200 text-sm rounded-lg px-4 py-3">
					{error}
				</div>
			)}

			{loading && !analytics ? (
				<div className="flex justify-center py-20">
					<div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
				</div>
			) : (
				<>
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
						<KpiCard
							label="Ortalama Süre"
							value={summary ? `${summary.averageDeliveryMinutes} dk` : "—"}
							badge={
								summary
									? summary.previousPeriodAvgMinutes > 0
										? `${trendPositive ? "↓" : "↑"} %${Math.abs(summary.trendPercent)} önceki döneme göre ${
												trendPositive ? "hızlı" : "yavaş"
											}`
										: "karşılaştırılacak önceki dönem yok"
									: undefined
							}
							badgeTone={trendPositive ? "good" : summary?.trendPercent === 0 ? "neutral" : "bad"}
						/>
						<KpiCard
							label="Toplam Teslimat"
							value={summary ? `${summary.totalDelivered}` : "—"}
							badge={summary ? "teslim edilen sipariş" : undefined}
							badgeTone="neutral"
						/>
						<KpiCard
							label="Hedefte"
							value={summary ? `%${summary.onTargetRate}` : "—"}
							badge={
								summary
									? `${summary.onTargetCount}/${summary.totalDelivered} sipariş ≤ ${targetMinutes} dk`
									: undefined
							}
							badgeTone={onTargetOk ? "good" : "bad"}
						/>
					</div>

					<div className="bg-slate-900/40 rounded-2xl border border-white/5 p-4">
						<div className="flex items-center justify-between mb-3">
							<h3 className="text-sm font-semibold text-slate-200">
								{analytics?.timeSeries.granularity === "hour"
									? "Saatlik Teslim Süresi"
									: "Günlük Teslim Süresi"}
							</h3>
							{analytics && (
								<span className="text-xs text-slate-500">Hedef çizgisi = {targetMinutes} dk</span>
							)}
						</div>
						{empty || chartData.length === 0 ? (
							<EmptyState label="Bu aralıkta teslim edilen sipariş yok" />
						) : (
							<ResponsiveContainer width="100%" height={260}>
								<LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
									<CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
									<XAxis dataKey="label" stroke="#64748b" fontSize={12} />
									<YAxis stroke="#64748b" fontSize={12} unit=" dk" />
									<Tooltip
										contentStyle={{
											background: "rgba(15,23,42,0.95)",
											border: "1px solid rgba(255,255,255,0.1)",
											borderRadius: 8,
										}}
										labelStyle={{ color: "#e2e8f0" }}
										formatter={(value, name) =>
											name === "dk"
												? [`${String(value)} dk`, "Ortalama"]
												: [`${String(value)}`, "Teslimat"]
										}
									/>
									<ReferenceLine
										y={targetMinutes}
										stroke="#facc15"
										strokeDasharray="4 4"
										label={{ value: "Hedef", fill: "#facc15", fontSize: 11, position: "right" }}
									/>
									<Line
										type="monotone"
										dataKey="dk"
										stroke="#818cf8"
										strokeWidth={2.5}
										dot={{ r: 4, fill: "#818cf8" }}
										activeDot={{ r: 6 }}
									/>
								</LineChart>
							</ResponsiveContainer>
						)}
					</div>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
						<div className="bg-slate-900/40 rounded-2xl border border-white/5 p-4">
							<h3 className="text-sm font-semibold text-slate-200 mb-3">Süre Dağılımı</h3>
							{empty || !analytics ? (
								<EmptyState label="Veri yok" compact />
							) : (
								<div className="space-y-2">
									{analytics.distribution.map((b) => {
										const width = (b.count / maxDistribution) * 100;
										return (
											<div key={b.bucket} className="flex items-center gap-3">
												<span className="w-16 text-xs text-slate-400 tabular-nums">{b.bucket}</span>
												<div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
													<div
														className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-[width] duration-500"
														style={{ width: `${width}%` }}
													/>
												</div>
												<span className="w-16 text-right text-xs text-slate-300 tabular-nums">
													{b.count} sipariş
												</span>
											</div>
										);
									})}
								</div>
							)}
						</div>

						<div className="bg-slate-900/40 rounded-2xl border border-white/5 p-4">
							<h3 className="text-sm font-semibold text-slate-200 mb-3">Sipariş Tipi Kırılımı</h3>
							{empty || !analytics || analytics.byOrderType.length === 0 ? (
								<EmptyState label="Tip bilgisi olan teslim yok" compact />
							) : (
								<div className="space-y-3">
									{analytics.byOrderType.map((t) => (
										<div
											key={t.orderType}
											className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2 border border-white/5"
										>
											<span className="text-sm text-slate-200 font-medium">{t.orderType}</span>
											<div className="flex items-center gap-4 text-xs text-slate-400">
												<span className="tabular-nums">
													<span className="text-slate-100 font-semibold">
														{t.averageDeliveryMinutes} dk
													</span>{" "}
													ortalama
												</span>
												<span className="tabular-nums">{t.deliveredCount} sipariş</span>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					</div>
				</>
			)}
		</div>
	);
}

function KpiCard({
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
			? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
			: badgeTone === "bad"
				? "text-rose-300 bg-rose-500/10 border-rose-500/30"
				: "text-slate-300 bg-slate-500/10 border-slate-500/30";
	return (
		<div className="bg-slate-900/40 rounded-2xl border border-white/5 p-4 flex flex-col justify-between min-h-[112px]">
			<p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
			<p className="text-3xl font-bold text-white tabular-nums">{value}</p>
			{badge ? (
				<span
					className={`text-[11px] font-medium px-2 py-1 rounded-full border w-fit ${toneClass}`}
				>
					{badge}
				</span>
			) : (
				<span className="h-5" />
			)}
		</div>
	);
}

function TargetMinutesEditor({
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
		<div className="min-w-[280px] bg-slate-900/40 rounded-2xl border border-white/5 p-4">
			<p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Teslim Hedefi</p>
			<div className="mt-3 flex items-stretch gap-2">
				<div className="flex flex-1 items-stretch rounded-xl bg-slate-950/50 border border-slate-700 overflow-hidden">
					<button
						type="button"
						onClick={() => onChange(value - 1)}
						aria-label="Teslim hedefini azalt"
						className="w-10 text-lg font-semibold text-slate-100 bg-slate-900/60 hover:bg-slate-800/80 transition-colors disabled:opacity-40"
						disabled={saving}
					>
						-
					</button>
					<input
						type="number"
						min={DELIVERY_TARGET_MIN}
						max={DELIVERY_TARGET_MAX}
						step={1}
						value={value}
						aria-label="Teslim hedefi dakikası"
						onChange={(event) => {
							const parsed = Number.parseInt(event.target.value, 10);
							onChange(Number.isNaN(parsed) ? DELIVERY_TARGET_MIN : parsed);
						}}
						className="w-full px-3 py-2 bg-transparent text-white text-center focus:outline-none"
						disabled={saving}
					/>
					<button
						type="button"
						onClick={() => onChange(value + 1)}
						aria-label="Teslim hedefini artır"
						className="w-10 text-lg font-semibold text-slate-100 bg-slate-900/60 hover:bg-slate-800/80 transition-colors disabled:opacity-40"
						disabled={saving}
					>
						+
					</button>
				</div>
				<button
					type="button"
					onClick={onSave}
					disabled={saving || !dirty}
					className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 text-white disabled:opacity-40 border border-white/5 transition-all flex items-center gap-2"
				>
					{saving ? (
						<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
					) : null}
					Kaydet
				</button>
			</div>
			<div className="mt-2 h-5 flex items-center gap-2">
				<span className="text-xs text-slate-500">
					{DELIVERY_TARGET_MIN}-{DELIVERY_TARGET_MAX} dk araliginda ayarlanabilir
				</span>
				{saveLabel === "saved" ? (
					<span className="text-xs font-medium text-emerald-400">Kaydedildi</span>
				) : null}
			</div>
			{error ? (
				<p className="mt-2 text-xs text-rose-200 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
					{error}
				</p>
			) : null}
		</div>
	);
}

function EmptyState({ label, compact = false }: { label: string; compact?: boolean }) {
	return (
		<div
			className={`flex items-center justify-center text-slate-500 text-sm ${
				compact ? "py-6" : "py-16"
			}`}
		>
			{label}
		</div>
	);
}
