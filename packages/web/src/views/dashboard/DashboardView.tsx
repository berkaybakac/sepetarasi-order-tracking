import { useEffect, useCallback } from "react";
import { OrderStatus, WS_CHANNELS } from "@sepetarasi/shared";
import type { WsMessage } from "@sepetarasi/shared";
import { useOrderStore, useOrdersByStatus } from "../../stores/orderStore";
import { useWebSocket } from "../../hooks/useWebSocket";

function StatsPanel() {
	const stats = useOrderStore((s) => s.stats);

	if (!stats) return null;

	return (
		<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
			<StatCard label="Toplam" value={stats.totalOrders} />
			<StatCard
				label="Ort. Hazırlama"
				value={stats.averagePrepMinutes != null ? `${stats.averagePrepMinutes} dk` : "-"}
			/>
			<StatCard label="Hazırlanan" value={stats.byStatus[OrderStatus.PREPARING]} color="text-yellow-600" />
			<StatCard label="Hazır" value={stats.byStatus[OrderStatus.READY]} color="text-green-600" />
		</div>
	);
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
	return (
		<div className="bg-white rounded-xl p-4 shadow-sm">
			<p className="text-sm text-gray-500">{label}</p>
			<p className={`text-2xl font-bold ${color || "text-gray-800"}`}>{value}</p>
		</div>
	);
}

function timeSince(dateStr: string): string {
	const diff = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "<1 dk";
	return `${mins} dk`;
}

function OrderColumn({ title, status, colorClass }: { title: string; status: OrderStatus; colorClass: string }) {
	const orders = useOrdersByStatus(status);

	return (
		<div className="flex-1 min-w-[280px]">
			<h2 className={`text-lg font-bold mb-3 ${colorClass}`}>
				{title} ({orders.length})
			</h2>
			<div className="space-y-2">
				{orders.map((order) => (
					<div key={order.id} className="bg-white rounded-lg p-3 shadow-sm border-l-4"
						style={{ borderLeftColor: status === OrderStatus.PREPARING ? "#eab308" : status === OrderStatus.READY ? "#22c55e" : "#3b82f6" }}
					>
						<div className="flex justify-between items-center">
							<span className="text-2xl font-bold">#{order.display_no}</span>
							<span className="text-sm text-gray-400">{timeSince(order.created_at)}</span>
						</div>
						{order.items && (
							<div className="text-sm text-gray-500 mt-1">
								{order.items.map((item) => `${item.quantity}x ${item.name}`).join(", ")}
							</div>
						)}
					</div>
				))}
			</div>
		</div>
	);
}

export function DashboardView() {
	const hydrate = useOrderStore((s) => s.hydrate);
	const applyWsEvent = useOrderStore((s) => s.applyWsEvent);
	const setConnected = useOrderStore((s) => s.setConnected);
	const connected = useOrderStore((s) => s.connected);

	const onMessage = useCallback((msg: WsMessage) => applyWsEvent(msg), [applyWsEvent]);
	const onConnect = useCallback(() => { setConnected(true); hydrate(); }, [setConnected, hydrate]);
	const onDisconnect = useCallback(() => setConnected(false), [setConnected]);

	useWebSocket({ channel: WS_CHANNELS.ORDERS, onMessage, onConnect, onDisconnect });

	useEffect(() => { hydrate(); }, [hydrate]);

	return (
		<div className="min-h-screen bg-gray-50">
			<header className="bg-white shadow-sm border-b px-4 py-3">
				<div className="flex items-center justify-between">
					<h1 className="text-xl font-bold text-gray-800">Sepetarasi Dashboard</h1>
					<span className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
				</div>
			</header>

			<main className="p-4">
				<StatsPanel />
				<div className="flex gap-4 overflow-x-auto">
					<OrderColumn title="Hazırlanıyor" status={OrderStatus.PREPARING} colorClass="text-yellow-600" />
					<OrderColumn title="Hazır" status={OrderStatus.READY} colorClass="text-green-600" />
					<OrderColumn title="Teslim Edildi" status={OrderStatus.DELIVERED} colorClass="text-blue-600" />
				</div>
			</main>
		</div>
	);
}
