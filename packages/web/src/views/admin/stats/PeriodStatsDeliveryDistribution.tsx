import type { DeliveryAnalyticsResult } from "@sepetarasi/shared";
import { StatsEmptyState } from "./StatsPanels";

interface Props {
	distribution: DeliveryAnalyticsResult["distribution"] | undefined;
	empty: boolean;
}

export function PeriodStatsDeliveryDistribution({ distribution, empty }: Props) {
	const maxCount = Math.max(1, ...(distribution?.map((d) => d.count) ?? [1]));

	return (
		<div className="rounded-[1.45rem] border border-border-subtle bg-surface-1/85 p-4">
			<h3 className="mb-3 text-sm font-semibold text-text-strong">Süre Dağılımı</h3>
			{empty || !distribution ? (
				<StatsEmptyState label="Veri yok" compact />
			) : (
				<div className="space-y-2">
					{distribution.map((b) => {
						const width = (b.count / maxCount) * 100;
						return (
							<div key={b.bucket} className="flex items-center gap-3">
								<span className="w-16 text-xs tabular-nums text-text-subtle">{b.bucket}</span>
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
	);
}
