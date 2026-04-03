import { useOrderList } from "../stores/orderStore";
import { OrderCard } from "./OrderCard";

export function OrderList() {
	const orders = useOrderList();

	if (orders.length === 0) {
		return (
			<div className="text-center text-gray-400 py-12">
				<p className="text-lg">Henüz sipariş yok</p>
				<p className="text-sm">Yeni sipariş oluşturun</p>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{orders.map((order) => (
				<OrderCard key={order.id} order={order} />
			))}
		</div>
	);
}
