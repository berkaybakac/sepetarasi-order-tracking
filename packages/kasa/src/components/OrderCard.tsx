import { OrderStatus } from "@sepetarasi/shared";
import type { Order } from "@sepetarasi/shared";
import { StatusButton } from "./StatusButton";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
	PREPARING: { label: "Hazırlanıyor", className: "bg-yellow-100 text-yellow-800" },
	READY: { label: "Hazır", className: "bg-green-100 text-green-800" },
	DELIVERED: { label: "Teslim", className: "bg-blue-100 text-blue-800" },
	CANCELLED: { label: "İptal", className: "bg-red-100 text-red-800" },
};

function timeSince(dateStr: string): string {
	const diff = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "az önce";
	if (mins < 60) return `${mins} dk`;
	return `${Math.floor(mins / 60)} sa ${mins % 60} dk`;
}

interface OrderCardProps {
	order: Order;
}

export function OrderCard({ order }: OrderCardProps) {
	const badge = STATUS_BADGE[order.status] ?? STATUS_BADGE.PREPARING;
	const isTerminal = order.status === "DELIVERED" || order.status === "CANCELLED";

	return (
		<div className={`border rounded-xl p-4 ${isTerminal ? "opacity-50" : "bg-white shadow-sm"}`}>
			<div className="flex items-center justify-between mb-3">
				<div className="flex items-center gap-3">
					<span className="text-3xl font-bold text-gray-800">#{order.display_no}</span>
					<span className={`px-3 py-1 rounded-full text-sm font-medium ${badge.className}`}>
						{badge.label}
					</span>
				</div>
				<span className="text-sm text-gray-500">{timeSince(order.created_at)}</span>
			</div>

			{order.items && order.items.length > 0 && (
				<div className="mb-3 text-sm text-gray-600">
					{order.items.map((item) => (
						<div key={item.id} className="flex justify-between">
							<span>
								{item.quantity}x {item.name}
							</span>
							<span>{((item.unit_price * item.quantity) / 100).toFixed(2)} TL</span>
						</div>
					))}
				</div>
			)}

			{order.notes && <p className="text-sm text-gray-500 italic mb-3">{order.notes}</p>}

			{!isTerminal && (
				<div className="flex gap-2 flex-wrap">
					<StatusButton order={order} targetStatus={OrderStatus.READY} />
					<StatusButton order={order} targetStatus={OrderStatus.DELIVERED} />
					<StatusButton order={order} targetStatus={OrderStatus.PREPARING} />
					<StatusButton order={order} targetStatus={OrderStatus.CANCELLED} />
				</div>
			)}
		</div>
	);
}
