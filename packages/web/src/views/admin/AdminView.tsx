import { WS_CHANNELS, WS_EVENTS } from "@sepetarasi/shared";
import type { DayStats, WsMessage } from "@sepetarasi/shared";
import { useCallback, useEffect, useState } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { api } from "../../lib/api";

type Period = "daily" | "weekly" | "monthly";

const PERIOD_LABELS: Record<Period, string> = {
	daily: "Günlük",
	weekly: "Haftalık",
	monthly: "Aylık",
};

export function AdminView() {
	const [period, setPeriod] = useState<Period>("daily");
	const [stats, setStats] = useState<DayStats | null>(null);
	const [loading, setLoading] = useState(false);

	const fetchStats = useCallback((p: Period) => {
		setLoading(true);
		api
			.getStatsByPeriod(p)
			.then(setStats)
			.catch(() => {})
			.finally(() => setLoading(false));
	}, []);

	// Refresh stats when an order is created or its status changes via WebSocket.
	// This keeps the average prep time up-to-date without the user having to
	// manually switch tabs or reload the page.
	const onMessage = useCallback(
		(msg: WsMessage) => {
			if (
				msg.event === WS_EVENTS.ORDER_CREATED ||
				msg.event === WS_EVENTS.ORDER_STATUS_CHANGED ||
				msg.event === WS_EVENTS.STATS_UPDATED
			) {
				fetchStats(period);
			}
		},
		[fetchStats, period],
	);

	useWebSocket({ channel: WS_CHANNELS.ORDERS, onMessage });

	useEffect(() => {
		fetchStats(period);
	}, [period, fetchStats]);

	return (
		<div className="min-h-screen bg-gray-50">
			<header className="bg-white shadow-sm border-b px-4 py-3">
				<h1 className="text-xl font-bold text-gray-800">Yönetici Paneli</h1>
			</header>

			<main className="p-6 max-w-md mx-auto">
				<div className="flex gap-2 mb-6">
					{(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
						<button
							key={p}
							type="button"
							onClick={() => setPeriod(p)}
							className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
								period === p
									? "bg-blue-600 text-white"
									: "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
							}`}
						>
							{PERIOD_LABELS[p]}
						</button>
					))}
				</div>

				<div className="bg-white rounded-xl shadow-sm p-8 text-center">
					<p className="text-sm text-gray-500 mb-3">Ortalama Hazırlanma Süresi</p>
					{loading ? (
						<p className="text-5xl font-bold text-gray-200">...</p>
					) : (
						<p className="text-5xl font-bold text-gray-800">
							{stats?.averagePrepMinutes != null ? (
								<>
									{stats.averagePrepMinutes}
									<span className="text-2xl font-normal text-gray-500 ml-1">dk</span>
								</>
							) : (
								<span className="text-gray-300">-</span>
							)}
						</p>
					)}
					{stats && !loading && (
						<p className="text-sm text-gray-400 mt-4">{stats.totalOrders} sipariş</p>
					)}
				</div>
			</main>
		</div>
	);
}
