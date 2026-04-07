import { OrderStatus } from "@sepetarasi/shared";
import { UI_LABELS } from "../../../constants/labels";
import { useOrderStore } from "../../../stores/orderStore";

/**
 * StatCards — Günün özet istatistiklerini (Toplam / Hazırlanıyor / Hazır) gösterir.
 */
export function StatCards() {
	const stats = useOrderStore((s) => s.stats);
	if (!stats) return null;

	const cards = [
		{
			label: UI_LABELS.TOTAL_ORDERS,
			value: stats.totalOrders,
			valueClass: "text-dark-text",
			iconClass: "text-brand-primary bg-brand-primary/10",
			icon: (
				<svg
					className="w-5 h-5"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
					/>
				</svg>
			),
		},
		{
			label: UI_LABELS.STATUS[OrderStatus.PREPARING],
			value: stats.byStatus[OrderStatus.PREPARING],
			valueClass: "text-brand-warning",
			iconClass: "text-brand-warning bg-brand-warning/10",
			icon: (
				<svg
					className="w-5 h-5"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
			),
		},
		{
			label: UI_LABELS.STATUS[OrderStatus.READY],
			value: stats.byStatus[OrderStatus.READY],
			valueClass: "text-brand-success",
			iconClass: "text-brand-success bg-brand-success/10",
			icon: (
				<svg
					className="w-5 h-5"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
				</svg>
			),
		},
	];

	return (
		<div className="grid grid-cols-3 gap-4">
			{cards.map((card) => (
				<div
					key={card.label}
					className="bg-dark-surface backdrop-blur-xl rounded-2xl border border-dark-border p-5 hover:border-white/15 hover:bg-white/8 transition-all"
				>
					<div className="flex items-start justify-between mb-4">
						<p className="text-xs font-medium text-dark-muted uppercase tracking-wider">
							{card.label}
						</p>
						<div
							className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.iconClass}`}
						>
							{card.icon}
						</div>
					</div>
					<p className={`text-4xl font-bold ${card.valueClass}`}>{card.value}</p>
				</div>
			))}
		</div>
	);
}
