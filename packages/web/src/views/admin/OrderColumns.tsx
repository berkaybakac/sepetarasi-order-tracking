import { OrderStatus } from "@sepetarasi/shared";
import { useOrderStore, useOrdersByStatus } from "../../stores/orderStore";

import { UI_LABELS } from "../../constants/labels";
import { timeSince } from "../../utils/date";

function OrderColumn({
	title,
	status,
	colorClass,
	borderClass,
}: {
	title: string;
	status: OrderStatus;
	colorClass: string;
	borderClass: string;
}) {
	const orders = useOrdersByStatus(status);

	return (
		<div className="flex-1 min-w-[220px]">
			<h2 className={`text-base font-semibold mb-3 ${colorClass}`}>
				{title} ({orders.length})
			</h2>
			<div className="space-y-2">
				{orders.map((order) => (
					<div
						key={order.id}
						className={`bg-brand-surface rounded-btn p-3 shadow-sm border-l-4 ${borderClass}`}
					>
						<div className="flex justify-between items-center">
							<span className="text-xl font-bold">#{order.display_no}</span>
							<span className="text-xs text-gray-400">{timeSince(order.created_at)}</span>
						</div>
						{order.items && (
							<div className="text-xs text-gray-500 mt-1">
								{order.items.map((item) => `${item.quantity}x ${item.name}`).join(", ")}
							</div>
						)}
					</div>
				))}
				{orders.length === 0 && (
					<p className="text-xs text-gray-400 text-center py-4">{UI_LABELS.ORDERS.EMPTY}</p>
				)}
			</div>
		</div>
	);
}

export function OrderColumns() {
	return (
		<div className="flex gap-4 overflow-x-auto pb-2">
			<OrderColumn
				title={UI_LABELS.STATUS[OrderStatus.PREPARING]}
				status={OrderStatus.PREPARING}
				colorClass="text-brand-warning"
				borderClass="border-brand-warning"
			/>
			<OrderColumn
				title={UI_LABELS.STATUS[OrderStatus.READY]}
				status={OrderStatus.READY}
				colorClass="text-brand-success"
				borderClass="border-brand-success"
			/>
			<OrderColumn
				title={UI_LABELS.STATUS[OrderStatus.DELIVERED]}
				status={OrderStatus.DELIVERED}
				colorClass="text-brand-primary"
				borderClass="border-brand-primary"
			/>
		</div>
	);
}

export function StatCards() {
	const stats = useOrderStore((s) => s.stats);
	if (!stats) return null;

	return (
		<div className="grid grid-cols-2 md:grid-cols-3 gap-3">
			<div className="bg-brand-surface rounded-card p-4 shadow-sm border border-gray-100">
				<p className="text-sm text-gray-500">{UI_LABELS.TOTAL_ORDERS}</p>
				<p className="text-2xl font-bold mt-1 text-gray-800">{stats.totalOrders}</p>
			</div>
			<div className="bg-brand-surface rounded-card p-4 shadow-sm border border-gray-100">
				<p className="text-sm text-gray-500">{UI_LABELS.STATUS[OrderStatus.PREPARING]}</p>
				<p className="text-2xl font-bold mt-1 text-brand-warning">
					{stats.byStatus[OrderStatus.PREPARING]}
				</p>
			</div>
			<div className="bg-brand-surface rounded-card p-4 shadow-sm border border-gray-100">
				<p className="text-sm text-gray-500">{UI_LABELS.STATUS[OrderStatus.READY]}</p>
				<p className="text-2xl font-bold mt-1 text-brand-success">
					{stats.byStatus[OrderStatus.READY]}
				</p>
			</div>
		</div>
	);
}
