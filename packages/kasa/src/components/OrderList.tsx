import { OrderStatus } from "@sepetarasi/shared";
import { AnimatePresence } from "framer-motion";
import { useOrderList } from "../stores/orderStore";
import { OrderCard } from "./OrderCard";

export function OrderList() {
	const activeOrders = useOrderList().filter(
		(o) => o.status === OrderStatus.PREPARING || o.status === OrderStatus.READY,
	);

	if (activeOrders.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-24 text-slate-400">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
					<line x1="3" y1="6" x2="21" y2="6" />
					<path d="M16 10a4 4 0 0 1-8 0" />
				</svg>
				<p className="text-xl font-semibold mt-4">Aktif sipariş yok</p>
				<p className="text-sm mt-1 text-slate-500">Sağ panelden yeni sipariş oluşturun</p>
			</div>
		);
	}

	return (
		<div className="p-5 grid [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-4 content-start [&>*]:min-w-0">
			<AnimatePresence mode="popLayout">
				{activeOrders.map((order) => (
					<OrderCard key={order.id} order={order} />
				))}
			</AnimatePresence>
		</div>
	);
}
