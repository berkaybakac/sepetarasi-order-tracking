import { OrderStatus } from "@sepetarasi/shared";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { OrdersIcon } from "../../../components/icons";
import { UI_LABELS } from "../../../constants/labels";
import { useInterval } from "../../../hooks/useInterval";
import { useOrdersByStatus } from "../../../stores/orderStore";
import { EmptyState } from "../ui/primitives";
import { OrderCard } from "./OrderCard";

export const DELIVERED_SCROLL_TRIGGER_COUNT = 6;
export const DELIVERED_SCROLL_THRESHOLD_PX = 640;

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
	const isLiveColumn = status === OrderStatus.PREPARING || status === OrderStatus.READY;
	const [tick, setTick] = useState(0);
	useInterval(() => setTick((t) => t + 1), isLiveColumn ? 30_000 : null);
	const isDeliveredOverflowList =
		status === OrderStatus.DELIVERED && orders.length >= DELIVERED_SCROLL_TRIGGER_COUNT;
	const orderListClassName = isDeliveredOverflowList
		? "space-y-3 overflow-y-auto pr-1"
		: "space-y-3";
	const orderListStyle = isDeliveredOverflowList
		? { maxHeight: `${DELIVERED_SCROLL_THRESHOLD_PX}px` }
		: undefined;

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

			<div
				className={orderListClassName}
				style={orderListStyle}
				data-order-list-status={status}
				data-order-list-scrollable={isDeliveredOverflowList ? "true" : "false"}
			>
				<AnimatePresence initial={false}>
					{orders.map((order) => (
						<OrderCard key={order.id} order={order} status={status} tick={tick} />
					))}
				</AnimatePresence>
				{orders.length === 0 && (
					<EmptyState
						title={`${title} akışı şu an boş`}
						icon={<OrdersIcon className="h-5 w-5" />}
						compact
					/>
				)}
			</div>
		</div>
	);
}
