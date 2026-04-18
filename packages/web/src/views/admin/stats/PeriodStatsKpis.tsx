import type { DeliveryAnalyticsResult } from "@sepetarasi/shared";
import { StatsKpiCard } from "./StatsPanels";

interface Props {
	summary: DeliveryAnalyticsResult["summary"] | undefined;
	targetMinutes: number;
	trendPositive: boolean;
	onTargetOk: boolean;
}

export function PeriodStatsKpis({ summary, targetMinutes, trendPositive, onTargetOk }: Props) {
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
			<StatsKpiCard
				label="Ortalama Süre"
				value={summary ? `${summary.averageDeliveryMinutes.toFixed(1)} dk` : "—"}
				badge={
					summary
						? summary.previousPeriodAvgMinutes > 0
							? summary.trendPercent === 0
								? "önceki dönemle aynı"
								: `${trendPositive ? "↓" : "↑"} %${Math.abs(summary.trendPercent).toFixed(1)} önceki döneme göre ${
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
	);
}
