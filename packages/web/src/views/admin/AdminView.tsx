import { WS_CHANNELS, WS_EVENTS } from "@sepetarasi/shared";
import type { DayStats, WsMessage } from "@sepetarasi/shared";
import { useCallback, useEffect, useRef, useState } from "react";
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

	const [volume, setVolume] = useState(100);
	const [savedVolume, setSavedVolume] = useState(100);
	const [saving, setSaving] = useState(false);
	const [saveLabel, setSaveLabel] = useState<"idle" | "saved">("idle");
	const saveLabelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const fetchStats = useCallback((p: Period) => {
		setLoading(true);
		api
			.getStatsByPeriod(p)
			.then(setStats)
			.catch(() => {})
			.finally(() => setLoading(false));
	}, []);

	useEffect(() => {
		api
			.getSettings()
			.then((s) => {
				const v = Number(s.audio_volume ?? 100);
				setVolume(v);
				setSavedVolume(v);
			})
			.catch(() => {});
	}, []);

	const handleSaveVolume = () => {
		setSaving(true);
		api
			.updateSetting("audio_volume", String(volume))
			.then(() => {
				setSavedVolume(volume);
				setSaveLabel("saved");
				if (saveLabelTimer.current) clearTimeout(saveLabelTimer.current);
				saveLabelTimer.current = setTimeout(() => setSaveLabel("idle"), 2000);
			})
			.catch(() => {})
			.finally(() => setSaving(false));
	};

	// Refresh stats when an order is created or its status changes via WebSocket.
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

	const volumeChanged = volume !== savedVolume;

	return (
		<div className="min-h-screen bg-gray-50">
			<header className="bg-white shadow-sm border-b px-4 py-3">
				<h1 className="text-xl font-bold text-gray-800">Yönetici Paneli</h1>
			</header>

			<main className="p-6 max-w-md mx-auto space-y-6">
				<div className="flex gap-2">
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

				<div className="bg-white rounded-xl shadow-sm p-6">
					<p className="text-sm text-gray-500 mb-4">Ses Seviyesi</p>
					<div className="flex items-center gap-4">
						<span className="text-sm text-gray-400 w-4">0</span>
						<input
							type="range"
							min={0}
							max={100}
							value={volume}
							onChange={(e) => setVolume(Number(e.target.value))}
							className="flex-1 accent-blue-600"
						/>
						<span className="text-sm font-medium text-gray-700 w-8 text-right">{volume}</span>
					</div>
					<div className="flex items-center justify-end gap-3 mt-4">
						{saveLabel === "saved" && <span className="text-sm text-green-600">Kaydedildi</span>}
						<button
							type="button"
							onClick={handleSaveVolume}
							disabled={saving || !volumeChanged}
							className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-700 transition-colors"
						>
							Kaydet
						</button>
					</div>
				</div>
			</main>
		</div>
	);
}
