import { OrderStatus } from "@sepetarasi/shared";
import { UI_LABELS } from "../../../constants/labels";
import { useOrdersByStatus } from "../../../stores/orderStore";
import { OrderCard } from "./OrderCard";

/**
 * Kolon başlık ve görsel config'i — tek yerden yönetilir.
 */
export const COLUMN_CONFIG = [
	{
		status: OrderStatus.PREPARING,
		title: UI_LABELS.STATUS[OrderStatus.PREPARING],
		dotClass: "bg-brand-warning shadow-[0_0_8px_rgba(245,158,11,0.8)]",
		countClass: "text-brand-warning bg-brand-warning/10 border-brand-warning/20",
	},
	{
		status: OrderStatus.READY,
		title: UI_LABELS.STATUS[OrderStatus.READY],
		dotClass: "bg-brand-success shadow-[0_0_8px_rgba(16,185,129,0.8)]",
		countClass: "text-brand-success bg-brand-success/10 border-brand-success/20",
	},
	{
		status: OrderStatus.DELIVERED,
		title: UI_LABELS.STATUS[OrderStatus.DELIVERED],
		dotClass: "bg-brand-primary shadow-[0_0_8px_rgba(37,99,235,0.8)]",
		countClass: "text-brand-primary bg-brand-primary/10 border-brand-primary/20",
	},
] as const;

type ColumnProps = (typeof COLUMN_CONFIG)[number];

/**
 * OrderColumn — Bir durum sütununu (Başlık + Kartlar) render eder.
 */
export function OrderColumn({ status, title, dotClass, countClass }: ColumnProps) {
	const orders = useOrdersByStatus(status);

	return (
		<div className="flex-1 min-w-[260px] flex flex-col gap-3">
			{/* Sütun Başlığı */}
			<div className="flex items-center justify-between px-1">
				<div className="flex items-center gap-2">
					<span className={`w-2 h-2 rounded-full ${dotClass}`} />
					<h2 className="text-sm font-semibold text-dark-text tracking-wide uppercase">{title}</h2>
				</div>
				<span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${countClass}`}>
					{orders.length}
				</span>
			</div>

			{/* Sipariş Kartları */}
			<div className="space-y-3">
				{orders.map((order) => (
					<OrderCard key={order.id} order={order} status={status} />
				))}
				{orders.length === 0 && (
					<div className="flex flex-col items-center justify-center py-12 rounded-2xl border border-dashed border-white/5">
						<svg
							className="w-8 h-8 text-white/10 mb-2"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1.5}
								d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
							/>
						</svg>
						<p className="text-xs text-dark-muted">{UI_LABELS.ORDERS.EMPTY}</p>
					</div>
				)}
			</div>
		</div>
	);
}
