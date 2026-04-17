import { OrderStatus } from "@sepetarasi/shared";
import { AnimatePresence } from "framer-motion";
import { OrdersIcon } from "../../../components/icons";
import { UI_LABELS } from "../../../constants/labels";
import { useOrdersByStatus } from "../../../stores/orderStore";
import { EmptyState } from "../ui/primitives";
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
		<div className="min-w-0 rounded-[1.4rem] border border-border-subtle bg-surface-3/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
			<div className="mb-4 flex items-center justify-between gap-2 px-1">
				<div className="flex min-w-0 items-center gap-2">
					<span className={`w-2 h-2 rounded-full ${dotClass}`} />
					<h2 className="min-w-0 truncate text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
						{title}
					</h2>
				</div>
				<span
					className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold ${countClass}`}
				>
					{orders.length}
				</span>
			</div>

			<div className="space-y-3">
				<AnimatePresence initial={false}>
					{orders.map((order) => (
						<OrderCard key={order.id} order={order} status={status} />
					))}
				</AnimatePresence>
				{orders.length === 0 && (
					<EmptyState
						title={`${title} akışı şu an boş`}
						description="Bağlantı açıksa yeni siparişler bu alanda otomatik belirecek."
						icon={<OrdersIcon className="h-5 w-5" />}
						compact
					/>
				)}
			</div>
		</div>
	);
}
