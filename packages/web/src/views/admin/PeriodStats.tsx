import {
	DELIVERY_TARGET_DEFAULT_MINUTES,
	DELIVERY_TARGET_MAX,
	DELIVERY_TARGET_MIN,
	SETTING_KEYS,
} from "@sepetarasi/shared";
import type { DeliveryAnalyticsResult } from "@sepetarasi/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { logger } from "../../lib/logger";
import { useSettingsStore } from "../../stores/settingsStore";
import { PeriodStatsDeliveryDistribution } from "./stats/PeriodStatsDeliveryDistribution";
import { PeriodStatsFilters } from "./stats/PeriodStatsFilters";
import { PeriodStatsKpis } from "./stats/PeriodStatsKpis";
import { PeriodStatsOrderTypeBreakdown } from "./stats/PeriodStatsOrderTypeBreakdown";
import { PeriodStatsTimeSeries } from "./stats/PeriodStatsTimeSeries";
import { TargetMinutesEditor } from "./stats/StatsPanels";
import { type DateRange, type PresetKey, rangeForPreset } from "./stats/range-utils";
import { BaseAdminCard, InlineAlert } from "./ui/primitives";

const SILENT_REFRESH_MIN_INTERVAL_MS = 15_000;

function clampInt(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

interface Props {
	active?: boolean;
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

export function PeriodStats({ active = true, wsTrigger, reconnectedAt }: Props) {
	const deliveryTargetMinutes = useSettingsStore((s) => s.deliveryTargetMinutes);
	const settingsLoadFailed = useSettingsStore((s) => s.loadFailed);
	const hydrateSettings = useSettingsStore((s) => s.hydrate);
	const setDeliveryTargetMinutes = useSettingsStore((s) => s.setDeliveryTargetMinutes);
	const [preset, setPreset] = useState<PresetKey>("last7");
	const [range, setRange] = useState<DateRange>(() => rangeForPreset("last7"));
	const [analytics, setAnalytics] = useState<DeliveryAnalyticsResult | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<UiErrorState | null>(null);
	const [targetDraft, setTargetDraft] = useState(deliveryTargetMinutes);
	const [targetSaving, setTargetSaving] = useState(false);
	const [targetError, setTargetError] = useState<string | null>(null);
	const [targetSaveLabel, setTargetSaveLabel] = useState<"idle" | "saved">("idle");
	const [targetRetrying, setTargetRetrying] = useState(false);
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const rangeRef = useRef(range);
	const analyticsRef = useRef<DeliveryAnalyticsResult | null>(null);
	const silentRefreshInFlightRef = useRef(false);
	const lastSilentRefreshAtRef = useRef(0);
	const lastRequestedRangeKeyRef = useRef<string | null>(null);
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
		if (!active) return;

		const rangeKey = `${range.from}:${range.to}`;
		const shouldSilentRefresh =
			lastRequestedRangeKeyRef.current === rangeKey && analyticsRef.current !== null;
		lastRequestedRangeKeyRef.current = rangeKey;

		void fetchAnalytics(range.from, range.to, shouldSilentRefresh);
	}, [active, range, fetchAnalytics]);

	useEffect(() => {
		if (!active || !wsTrigger) return;
		void fetchAnalytics(rangeRef.current.from, rangeRef.current.to, true);
	}, [active, wsTrigger, fetchAnalytics]);

	useEffect(() => {
		if (!active || !reconnectedAt) return;
		void fetchAnalytics(rangeRef.current.from, rangeRef.current.to, true);
	}, [active, reconnectedAt, fetchAnalytics]);

	const handlePreset = (key: PresetKey) => {
		setPreset(key);
		if (key !== "custom") setRange(rangeForPreset(key));
	};

	const handleCustomChange = (nextRange: DateRange) => {
		setPreset("custom");
		setRange(nextRange);
	};

	const handleTargetDraftChange = (nextValue: number) => {
		setTargetDraft(clampInt(nextValue, DELIVERY_TARGET_MIN, DELIVERY_TARGET_MAX));
		setTargetError(null);
	};

	const handleSaveTarget = async () => {
		if (settingsLoadFailed) return;
		setTargetSaving(true);
		setTargetError(null);
		setTargetSaveLabel("idle");

		try {
			await api.updateSetting(SETTING_KEYS.DELIVERY_TARGET_MINUTES, String(targetDraft));
			await hydrateSettings();
			const settingsState = useSettingsStore.getState();
			const syncedTargetMinutes = settingsState.loadFailed
				? targetDraft
				: settingsState.deliveryTargetMinutes;
			if (settingsState.loadFailed) {
				setDeliveryTargetMinutes(targetDraft);
			}
			lastSyncedTargetRef.current = syncedTargetMinutes;
			setTargetDraft(syncedTargetMinutes);
			await fetchAnalytics(range.from, range.to);
			setTargetSaveLabel("saved");
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
			saveTimerRef.current = setTimeout(() => setTargetSaveLabel("idle"), 2000);
		} catch (err) {
			setTargetError(err instanceof Error ? err.message : "Teslim hedefi kaydedilemedi.");
		} finally {
			setTargetSaving(false);
		}
	};

	const handleRetryTargetLoad = async () => {
		setTargetRetrying(true);
		setTargetError(null);
		try {
			await hydrateSettings();
		} catch (err) {
			setTargetError(err instanceof Error ? err.message : "Ayarlar yeniden yüklenemedi.");
		} finally {
			setTargetRetrying(false);
		}
	};

	const summary = analytics?.summary;
	const targetMinutes =
		summary?.targetMinutes ?? deliveryTargetMinutes ?? DELIVERY_TARGET_DEFAULT_MINUTES;
	const trendPositive = summary ? summary.trendPercent < 0 : false;
	const onTargetOk = summary ? summary.onTargetRate >= 80 : false;
	const empty = !loading && summary != null && summary.totalDelivered === 0;
	const targetDirty = targetDraft !== deliveryTargetMinutes;
	const targetLoadError = settingsLoadFailed
		? "Teslim hedefi yüklenemedi. Ayar doğrulanmadan düzenleme kapalı."
		: null;

	return (
		<BaseAdminCard accent="primary" className="md:p-6" bodyClassName="space-y-5">
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
							disabled={settingsLoadFailed}
							disabledMessage={targetLoadError}
							error={targetError}
							saveLabel={targetSaveLabel}
							onRetry={() => void handleRetryTargetLoad()}
							retrying={targetRetrying}
						/>
					</div>
				</div>

				<PeriodStatsFilters
					preset={preset}
					range={range}
					onPresetChange={handlePreset}
					onCustomChange={handleCustomChange}
				/>

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
						<PeriodStatsKpis
							summary={summary}
							targetMinutes={targetMinutes}
							trendPositive={trendPositive}
							onTargetOk={onTargetOk}
						/>

						<PeriodStatsTimeSeries
							analytics={analytics}
							targetMinutes={targetMinutes}
							empty={empty}
						/>

						<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
							<PeriodStatsDeliveryDistribution
								distribution={analytics?.distribution}
								empty={empty}
							/>
							<PeriodStatsOrderTypeBreakdown byOrderType={analytics?.byOrderType} empty={empty} />
						</div>
					</>
				)}
			</div>
		</BaseAdminCard>
	);
}
