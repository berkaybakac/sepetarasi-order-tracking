import type { DeliveryAnalyticsResult } from "@sepetarasi/shared";
import { StatsEmptyState } from "./StatsPanels";

interface Props {
	byOrderType: DeliveryAnalyticsResult["byOrderType"] | undefined;
	empty: boolean;
}

export function PeriodStatsOrderTypeBreakdown({ byOrderType, empty }: Props) {
	return (
		<div className="flex h-full flex-col rounded-[1.45rem] border border-border-subtle bg-surface-1/85 p-4">
			<h3 className="mb-3 text-sm font-semibold text-text-strong">
				Sipariş Tiplerine Göre Özet
			</h3>
			{empty || !byOrderType || byOrderType.length === 0 ? (
				<StatsEmptyState label="Tip bilgisi olan teslim yok" compact />
			) : (
				<div className="flex flex-1 flex-col justify-center gap-4">
					{byOrderType.map((t) => (
						<div
							key={t.orderType}
							className="flex min-h-[3.75rem] items-center justify-between rounded-lg border border-border-subtle bg-surface-1 px-4 py-3"
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
	);
}
