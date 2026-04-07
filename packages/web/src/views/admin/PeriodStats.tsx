import type { DayStats, StatPeriod } from "@sepetarasi/shared";
import { STAT_PERIODS } from "@sepetarasi/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { UI_LABELS } from "../../constants/labels";
import { api } from "../../lib/api";

const PERIOD_LABELS: Record<StatPeriod, string> = {
	daily: "Günlük",
	weekly: "Haftalık",
	monthly: "Aylık",
};

interface Props {
	/** AdminView'deki WS eventi her tetiklendiğinde artan sayaç.
	 * Bu değer değişince PeriodStats mevcut period için yeniden çeker. */
	refreshTrigger?: number;
}

export function PeriodStats({ refreshTrigger }: Props) {
	const [period, setPeriod] = useState<StatPeriod>("daily");
	const periodRef = useRef<StatPeriod>("daily");
	const [stats, setStats] = useState<DayStats | null>(null);
	const [loading, setLoading] = useState(false);

	const fetchStats = useCallback((p: StatPeriod) => {
		setLoading(true);
		api
			.getStatsByPeriod(p)
			.then((data) => {
				setStats(data);
			})
			.catch((err) => console.error("[PeriodStats] fetch failed:", err))
			.finally(() => setLoading(false));
	}, []);

	useEffect(() => {
		periodRef.current = period;
		fetchStats(period);
	}, [period, fetchStats]);

	// WS eventi gelince (AdminView'den refreshTrigger artar) → yeniden çek
	useEffect(() => {
		if (refreshTrigger) fetchStats(periodRef.current);
	}, [refreshTrigger, fetchStats]);

	return (
		<div className="bg-brand-surface rounded-card shadow-sm p-5 space-y-4">
			<div className="flex gap-2">
				{STAT_PERIODS.map((p) => (
					<button
						key={p}
						type="button"
						onClick={() => setPeriod(p)}
						className={`flex-1 py-2 px-4 rounded-btn font-medium text-sm transition-colors ${
							period === p
								? "bg-brand-primary text-white"
								: "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
						}`}
					>
						{PERIOD_LABELS[p]}
					</button>
				))}
			</div>

			<div className="text-center py-4">
				<p className="text-sm text-gray-500 mb-2">{UI_LABELS.AVG_PREP_TIME}</p>
				{loading ? (
					<p className="text-5xl font-bold text-gray-200">...</p>
				) : (
					<p className="text-5xl font-bold text-gray-800">
						{stats?.averagePrepMinutes != null ? (
							<>
								{stats.averagePrepMinutes}
								<span className="text-2xl font-normal text-gray-500 ml-1">
									{UI_LABELS.ORDERS.MINUTES_SHORT}
								</span>
							</>
						) : (
							<span className="text-gray-300">-</span>
						)}
					</p>
				)}
				{stats && !loading && (
					<p className="text-sm text-gray-400 mt-2">{stats.totalOrders} sipariş</p>
				)}
			</div>
		</div>
	);
}
