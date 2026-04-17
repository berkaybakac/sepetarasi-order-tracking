import { OrderStatus } from "@sepetarasi/shared";
import { CheckIcon, ClockIcon, OrdersIcon } from "../../../components/icons";
import { UI_LABELS } from "../../../constants/labels";
import { useOrderStore } from "../../../stores/orderStore";
import { MetricTile } from "../ui/primitives";

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
			detail: "Bugün sisteme düşen sipariş",
			tone: "info" as const,
			icon: <OrdersIcon className="h-4 w-4" />,
		},
		{
			label: UI_LABELS.STATUS[OrderStatus.PREPARING],
			value: stats.byStatus[OrderStatus.PREPARING],
			detail: "Mutfakta aktif hazırlanan sipariş",
			tone: "warning" as const,
			icon: <ClockIcon className="h-4 w-4" />,
		},
		{
			label: UI_LABELS.STATUS[OrderStatus.READY],
			value: stats.byStatus[OrderStatus.READY],
			detail: "Teslime hazır bekleyen sipariş",
			tone: "success" as const,
			icon: <CheckIcon className="h-4 w-4" />,
		},
	];

	return (
		<div className="grid gap-4 md:grid-cols-3">
			{cards.map((card) => (
				<MetricTile
					key={card.label}
					label={card.label}
					value={card.value}
					detail={card.detail}
					icon={card.icon}
					tone={card.tone}
				/>
			))}
		</div>
	);
}
