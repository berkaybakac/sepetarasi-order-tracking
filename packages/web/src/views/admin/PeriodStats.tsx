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
	/** WS'den gelen veri değişim sinyali */
	wsTrigger?: number;
	/** Re-connect zaman damgası (Store'dan gelir) */
	reconnectedAt?: number;
}

export function PeriodStats({ wsTrigger, reconnectedAt }: Props) {
	const [period, setPeriod] = useState<StatPeriod>("daily");
	const periodRef = useRef<StatPeriod>("daily");
	const [stats, setStats] = useState<DayStats | null>(null);
	const [loading, setLoading] = useState(false);

	const fetchStats = useCallback((p: StatPeriod, silent = false) => {
		if (!silent) setLoading(true);
		api
			.getStatsByPeriod(p)
			.then((data) => {
				setStats(data);
			})
			.catch((err) => console.error("[PeriodStats] fetch failed:", err))
			.finally(() => {
				if (!silent) setLoading(false);
			});
	}, []);

	useEffect(() => {
		periodRef.current = period;
		fetchStats(period);
	}, [period, fetchStats]);

	// WS eventi gelince → yeniden çek (sessizce)
	useEffect(() => {
		if (wsTrigger) fetchStats(periodRef.current, true);
	}, [wsTrigger, fetchStats]);

	// Re-connect olunca → yeniden çek (sessizce)
	useEffect(() => {
		if (reconnectedAt) fetchStats(periodRef.current, true);
	}, [reconnectedAt, fetchStats]);

	return (
		<div className="bg-white/5 backdrop-blur-xl rounded-3xl shadow-lg shadow-black/20 border border-white/5 p-6 space-y-5 relative overflow-hidden group hover:border-white/10 transition-colors">
			{/* Subtle inner glow */}
			<div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

			<div className="flex gap-2 relative z-10 w-full p-1 bg-slate-900/50 rounded-xl border border-white/5">
				{STAT_PERIODS.map((p) => (
					<button
						key={p}
						type="button"
						onClick={() => setPeriod(p)}
						className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all duration-300 ${
							period === p
								? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/20"
								: "text-slate-400 hover:text-white hover:bg-white/5"
						}`}
					>
						{PERIOD_LABELS[p]}
					</button>
				))}
			</div>

			<div className="text-center py-6 relative z-10">
				<p className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-2">
					{UI_LABELS.AVG_PREP_TIME}
				</p>
				{loading ? (
					<div className="flex justify-center h-14 items-center">
						<div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
					</div>
				) : (
					<p className="text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-white to-slate-400">
						{stats?.averagePrepMinutes != null ? (
							<>
								{stats.averagePrepMinutes}
								<span className="text-2xl font-medium text-slate-500 ml-2">
									{UI_LABELS.ORDERS.MINUTES_SHORT}
								</span>
							</>
						) : (
							<span className="text-slate-600">-</span>
						)}
					</p>
				)}
				<div className="h-6 mt-3 flex items-center justify-center">
					{stats && !loading && (
						<span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-primary bg-brand-primary/10 px-3 py-1 rounded-full border border-brand-primary/20">
							<svg
								className="w-4 h-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								aria-hidden="true"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
								/>
							</svg>
							{stats.totalOrders} toplam sipariş
						</span>
					)}
				</div>
			</div>
		</div>
	);
}
