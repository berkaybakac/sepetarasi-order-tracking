import { OrderStatus } from "@sepetarasi/shared";
import { AnimatePresence } from "framer-motion";
import { useOrderList, useOrderStore } from "../stores/orderStore";
import { OrderCard } from "./OrderCard";

export function OrderList() {
	const activeOrders = useOrderList().filter(
		(o) => o.status === OrderStatus.PREPARING || o.status === OrderStatus.READY,
	);
	const hasAnyOrders = useOrderStore((s) => s.orders.size > 0);
	const error = useOrderStore((s) => s.error);
	const hydrate = useOrderStore((s) => s.hydrate);

	if (activeOrders.length === 0) {
		if (error && !hasAnyOrders) {
			return (
				<div className="flex flex-col items-center justify-center py-24 px-6 text-center">
					<div className="max-w-md w-full rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
						<p className="text-lg font-semibold text-red-300">Siparişler alınamadı</p>
						<p className="mt-2 text-sm text-red-200/80">
							Sunucuya bağlanılamadı veya veriler alınamadı. Bağlantıyı kontrol edip tekrar deneyin.
						</p>
						<button
							type="button"
							onClick={() => void hydrate()}
							className="mt-5 w-full rounded-lg border border-red-400/40 bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-100 transition-colors hover:bg-red-500/30"
						>
							Tekrar dene
						</button>
					</div>
				</div>
			);
		}

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
