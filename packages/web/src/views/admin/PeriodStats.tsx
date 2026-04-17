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
import { logger } from "../../lib/logger";
import { useSettingsStore } from "../../stores/settingsStore";
import { StatsEmptyState, StatsKpiCard, TargetMinutesEditor } from "./stats/StatsPanels";
import { InlineAlert } from "./ui/primitives";

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

const SILENT_REFRESH_MIN_INTERVAL_MS = 15_000;

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

interface UiErrorState {
	message: string;
	tone: "warning" | "danger";
}

function resolveUiError(error: unknown): UiErrorState {
	const message =
		typeof error === "object" && error && "message" in error && typeof error.message === "string"
			? error.message
			: "Veri alınamadı.";
	const code =
		typeof error === "object" && error && "code" in error && typeof error.code === "string"
			? error.code
			: undefined;
	const recoverable =
		typeof error === "object" && error && "recoverable" in error
			? Boolean(error.recoverable)
			: false;

	return {
		message,
		tone: code === "RATE_LIMITED" || recoverable ? "warning" : "danger",
	};
}

export function PeriodStats({ wsTrigger, reconnectedAt }: Props) {
	const deliveryTargetMinutes = useSettingsStore((s) => s.deliveryTargetMinutes);
	const hydrateSettings = useSettingsStore((s) => s.hydrate);
	const setDeliveryTargetMinutes = useSettingsStore((s) => s.setDeliveryTargetMinutes);
	const [preset, setPreset] = useState<PresetKey>("last7");
	const [range, setRange] = useState<{ from: string; to: string }>(() => rangeForPreset("last7"));
	const [analytics, setAnalytics] = useState<DeliveryAnalyticsResult | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<UiErrorState | null>(null);
	const [targetDraft, setTargetDraft] = useState(deliveryTargetMinutes);
	const [targetSaving, setTargetSaving] = useState(false);
	const [targetError, setTargetError] = useState<string | null>(null);
	const [targetSaveLabel, setTargetSaveLabel] = useState<"idle" | "saved">("idle");
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const rangeRef = useRef(range);
	const analyticsRef = useRef<DeliveryAnalyticsResult | null>(null);
	const silentRefreshInFlightRef = useRef(false);
	const lastSilentRefreshAtRef = useRef(0);
	// Son senkron edilen server değeri. Draft ile karşılaştırıp kullanıcının dirty edit'ini WS override'dan koruyoruz.
	const lastSyncedTargetRef = useRef(deliveryTargetMinutes);

	const fetchAnalytics = useCallback(async (from: string, to: string, silent = false) => {
		if (silent) {
			const now = Date.now();
			if (silentRefreshInFlightRef.current) return;
			if (now - lastSilentRefreshAtRef.current < SILENT_REFRESH_MIN_INTERVAL_MS) return;
			silentRefreshInFlightRef.current = true;
			lastSilentRefreshAtRef.current = now;
		}

		if (!silent) setLoading(true);
		if (!silent) setError(null);
		try {
			const data = await api.getDeliveryAnalytics(from, to);
			setAnalytics(data);
			analyticsRef.current = data;
			setError(null);
		} catch (err) {
			if (silent && analyticsRef.current) {
				logger.warn("PeriodStats", "Silent analytics refresh failed; keeping previous data.", err);
				return;
			}
			setError(resolveUiError(err));
		} finally {
			if (silent) {
				silentRefreshInFlightRef.current = false;
			} else {
				setLoading(false);
			}
		}
	}, []);

	useEffect(
		() => () => {
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
		},
		[],
	);

	useEffect(() => {
		rangeRef.current = range;
	}, [range]);

	useEffect(() => {
		analyticsRef.current = analytics;
	}, [analytics]);

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
		if (!wsTrigger) return;
		void fetchAnalytics(rangeRef.current.from, rangeRef.current.to, true);
	}, [wsTrigger, fetchAnalytics]);

	useEffect(() => {
		if (!reconnectedAt) return;
		void fetchAnalytics(rangeRef.current.from, rangeRef.current.to, true);
	}, [reconnectedAt, fetchAnalytics]);

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
		<div className="rounded-[2rem] border border-border-subtle bg-surface-2/95 p-5 shadow-elevation-1 backdrop-blur-xl md:p-6">
			<div className="space-y-5">
				<div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
					<div className="space-y-2">
						<div>
							<p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-brand-primary">
								Sevkiyat Analizi
							</p>
							<h2 className="mt-0.5 text-[1.35rem] font-semibold tracking-tight text-text-strong">
								Ortalama Teslim Süresi
							</h2>
						</div>
						<div className="flex flex-wrap items-center gap-2 text-sm text-text-subtle">
							<span className="rounded-full border border-border-subtle bg-surface-1/80 px-3 py-1 text-text-strong">
								Hedef {targetMinutes} dk
							</span>
							{summary ? (
								<span className="rounded-full border border-border-subtle bg-surface-1/70 px-3 py-1">
									{summary.totalDelivered} teslimat
								</span>
							) : null}
						</div>
					</div>
					<div className="w-full xl:w-auto">
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
				</div>

				<div className="flex flex-col gap-3 rounded-[1.35rem] border border-border-subtle bg-surface-1/80 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
					<div className="flex flex-wrap items-center gap-2">
						{PRESETS.map((p) => (
							<button
								key={p.key}
								type="button"
								onClick={() => handlePreset(p.key)}
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
							onChange={(e) => handleCustomChange("from", e.target.value)}
							className="h-10 rounded-[0.9rem] border border-border-subtle bg-surface-1 px-3 text-sm text-text-strong"
						/>
						<span className="text-sm text-text-subtle">—</span>
						<input
							type="date"
							value={range.to}
							min={range.from}
							onChange={(e) => handleCustomChange("to", e.target.value)}
							className="h-10 rounded-[0.9rem] border border-border-subtle bg-surface-1 px-3 text-sm text-text-strong"
						/>
					</div>
				</div>

				{error ? (
					<InlineAlert className="px-3.5 py-2.5" tone={error.tone}>
						{error.message}
					</InlineAlert>
				) : null}

				{loading && !analytics ? (
					<div className="flex justify-center py-16">
						<div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
					</div>
				) : (
					<>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
							<StatsKpiCard
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
							<StatsKpiCard
								label="Toplam Teslimat"
								value={summary ? `${summary.totalDelivered}` : "—"}
								badge={summary ? "teslim edilen sipariş" : undefined}
								badgeTone="neutral"
							/>
							<StatsKpiCard
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

						<div className="rounded-[1.45rem] border border-border-subtle bg-surface-1/85 p-4">
							<div className="mb-3 flex items-center justify-between">
								<h3 className="text-sm font-semibold text-text-strong">
									{analytics?.timeSeries.granularity === "hour"
										? "Saatlik Teslim Süresi"
										: "Günlük Teslim Süresi"}
								</h3>
								{analytics ? (
									<span className="text-xs text-text-subtle">{targetMinutes} dk hedef</span>
								) : null}
							</div>
							{empty || chartData.length === 0 ? (
								<StatsEmptyState label="Bu aralıkta teslim edilen sipariş yok" />
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
											stroke="#38bdf8"
											strokeWidth={2.5}
											dot={{ r: 4, fill: "#38bdf8" }}
											activeDot={{ r: 6 }}
										/>
									</LineChart>
								</ResponsiveContainer>
							)}
						</div>

						<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
							<div className="rounded-[1.45rem] border border-border-subtle bg-surface-1/85 p-4">
								<h3 className="mb-3 text-sm font-semibold text-text-strong">Süre Dağılımı</h3>
								{empty || !analytics ? (
									<StatsEmptyState label="Veri yok" compact />
								) : (
									<div className="space-y-2">
										{analytics.distribution.map((b) => {
											const width = (b.count / maxDistribution) * 100;
											return (
												<div key={b.bucket} className="flex items-center gap-3">
													<span className="w-16 text-xs tabular-nums text-text-subtle">
														{b.bucket}
													</span>
													<div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-1">
														<div
															className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-accent-strong transition-[width] duration-500"
															style={{ width: `${width}%` }}
														/>
													</div>
													<span className="w-16 text-right text-xs tabular-nums text-text-muted">
														{b.count} sipariş
													</span>
												</div>
											);
										})}
									</div>
								)}
							</div>

							<div className="rounded-[1.45rem] border border-border-subtle bg-surface-1/85 p-4">
								<h3 className="mb-3 text-sm font-semibold text-text-strong">
									Sipariş Tipi Kırılımı
								</h3>
								{empty || !analytics || analytics.byOrderType.length === 0 ? (
									<StatsEmptyState label="Tip bilgisi olan teslim yok" compact />
								) : (
									<div className="space-y-3">
										{analytics.byOrderType.map((t) => (
											<div
												key={t.orderType}
												className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-1 px-3 py-2"
											>
												<span className="text-sm font-medium text-text-strong">{t.orderType}</span>
												<div className="flex items-center gap-4 text-xs text-text-subtle">
													<span className="tabular-nums">
														<span className="font-semibold text-text-strong">
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
		</div>
	);
}
