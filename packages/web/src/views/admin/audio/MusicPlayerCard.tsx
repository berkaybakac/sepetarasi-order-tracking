import { useEffect, useMemo } from "react";
import { UI_LABELS } from "../../../constants/labels";
import { api } from "../../../lib/api";
import { logger } from "../../../lib/logger";
import { useMusicStore } from "../../../stores/musicStore";

export function MusicPlayerCard() {
	const status = useMusicStore((s) => s.status);
	const setStatus = useMusicStore((s) => s.setStatus);

	useEffect(() => {
		api
			.getMusicStatus()
			.then(setStatus)
			.catch((error) => logger.error("MusicPlayerCard", "Failed to fetch music status.", error));
	}, [setStatus]);

	const refreshStatus = () =>
		api
			.getMusicStatus()
			.then(setStatus)
			.catch((error) => logger.error("MusicPlayerCard", "Failed to refresh music status.", error));

	const handlePlayPause = () => {
		const action = status?.isPlaying ? api.musicPause() : api.musicPlay();
		action
			.then(refreshStatus)
			.catch((error) => logger.error("MusicPlayerCard", "Play/pause failed.", error));
	};

	const handleSkip = () => {
		api
			.musicSkip()
			.then(refreshStatus)
			.catch((error) => logger.error("MusicPlayerCard", "Skip failed.", error));
	};

	const handlePrevious = () => {
		api
			.musicPrevious()
			.then(refreshStatus)
			.catch((error) => logger.error("MusicPlayerCard", "Previous track failed.", error));
	};

	const handleToggleLoop = () => {
		api
			.setMusicMode({ loop: !(status?.loop ?? true) })
			.then(refreshStatus)
			.catch((error) => logger.error("MusicPlayerCard", "Loop toggle failed.", error));
	};

	const handleToggleShuffle = () => {
		api
			.setMusicMode({ shuffle: !(status?.shuffle ?? false) })
			.then(refreshStatus)
			.catch((error) => logger.error("MusicPlayerCard", "Shuffle toggle failed.", error));
	};

	const statusLabel = useMemo(() => {
		if (!status) return "—";
		if (status.isDucked) return UI_LABELS.MUSIC_PLAYER.DUCKED;
		if (status.isPlaying) return UI_LABELS.MUSIC_PLAYER.NOW_PLAYING;
		if (status.isPaused) return UI_LABELS.MUSIC_PLAYER.PAUSED;
		return UI_LABELS.MUSIC_PLAYER.STOPPED;
	}, [status]);

	const statusColor = useMemo(() => {
		if (!status) return "text-slate-500";
		if (status.isDucked) return "text-amber-400";
		if (status.isPlaying) return "text-brand-success";
		if (status.isPaused) return "text-blue-400";
		return "text-slate-500";
	}, [status]);

	const trackName = status?.currentTrackName ?? UI_LABELS.MUSIC_PLAYER.NO_TRACK;
	const showPause = status?.isPlaying ?? false;
	const loopEnabled = status?.loop ?? true;
	const shuffleEnabled = status?.shuffle ?? false;

	const SOUND_BARS = ["a", "b", "c", "d", "e"] as const;

	return (
		<div className="bg-white/5 backdrop-blur-xl rounded-3xl shadow-lg shadow-black/20 border border-white/5 p-6 relative overflow-hidden group hover:border-white/10 transition-colors">
			<div className="absolute inset-0 bg-gradient-to-tr from-green-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

			<div className="relative z-10 flex items-center justify-between mb-4">
				<h3 className="text-sm font-medium text-slate-400 flex items-center gap-2 uppercase tracking-wider">
					<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<title>oynatıcı ikonu</title>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
						/>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					{UI_LABELS.MUSIC_PLAYER.TITLE}
				</h3>
				<span className={`text-xs font-semibold uppercase tracking-wider ${statusColor}`}>
					{statusLabel}
				</span>
			</div>

			<div className="relative z-10 mb-6">
				<p className="text-white font-medium truncate text-base" title={trackName}>
					{trackName}
				</p>
				{status?.isPlaying && (
					<div className="flex items-end gap-0.5 mt-2 h-4">
						{SOUND_BARS.map((barKey, i) => (
							<div
								key={barKey}
								className="w-1 bg-brand-success rounded-full animate-pulse"
								style={{
									height: `${40 + Math.sin(i * 1.2) * 30}%`,
									animationDelay: `${i * 0.15}s`,
									animationDuration: `${0.8 + i * 0.1}s`,
								}}
							/>
						))}
					</div>
				)}
			</div>

			{/* Kontrol Satırı: [karıştır] [önceki] [oynat/duraklat] [sonraki] [döngü] */}
			<div className="relative z-10 flex items-center justify-center gap-3">
				{/* Karışık Çal (Shuffle) */}
				<button
					type="button"
					onClick={handleToggleShuffle}
					title={
						shuffleEnabled ? UI_LABELS.MUSIC_PLAYER.SHUFFLE_ON : UI_LABELS.MUSIC_PLAYER.SHUFFLE_OFF
					}
					className={`p-2 rounded-xl border transition-all ${
						shuffleEnabled
							? "bg-cyan-500/15 border-cyan-400/30 text-cyan-400 hover:bg-cyan-500/25"
							: "bg-white/5 border-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/10"
					}`}
				>
					{/* YouTube shuffle ikonu: çapraz oklar */}
					<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
						<title>
							{shuffleEnabled
								? UI_LABELS.MUSIC_PLAYER.SHUFFLE_ON
								: UI_LABELS.MUSIC_PLAYER.SHUFFLE_OFF}
						</title>
						<path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
					</svg>
				</button>

				{/* Önceki Parça */}
				<button
					type="button"
					onClick={handlePrevious}
					title={UI_LABELS.MUSIC_PLAYER.PREVIOUS}
					className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 hover:text-white transition-all"
				>
					<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
						<title>{UI_LABELS.MUSIC_PLAYER.PREVIOUS}</title>
						<path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
					</svg>
				</button>

				{/* Oynat / Duraklat */}
				<button
					type="button"
					onClick={handlePlayPause}
					title={showPause ? UI_LABELS.MUSIC_PLAYER.PAUSE : UI_LABELS.MUSIC_PLAYER.PLAY}
					className="p-3 rounded-2xl bg-gradient-to-br from-green-500 to-teal-500 hover:from-green-400 hover:to-teal-400 text-white shadow-lg shadow-green-500/20 transition-all"
				>
					{showPause ? (
						<svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
							<title>{UI_LABELS.MUSIC_PLAYER.PAUSE}</title>
							<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
						</svg>
					) : (
						<svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
							<title>{UI_LABELS.MUSIC_PLAYER.PLAY}</title>
							<path d="M8 5v14l11-7z" />
						</svg>
					)}
				</button>

				{/* Sonraki Parça */}
				<button
					type="button"
					onClick={handleSkip}
					title={UI_LABELS.MUSIC_PLAYER.SKIP}
					className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 hover:text-white transition-all"
				>
					<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
						<title>{UI_LABELS.MUSIC_PLAYER.SKIP}</title>
						<path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z" />
					</svg>
				</button>

				{/* Döngü (Loop) */}
				<button
					type="button"
					onClick={handleToggleLoop}
					title={loopEnabled ? UI_LABELS.MUSIC_PLAYER.LOOP_ON : UI_LABELS.MUSIC_PLAYER.LOOP_OFF}
					className={`p-2 rounded-xl border transition-all ${
						loopEnabled
							? "bg-emerald-500/15 border-emerald-400/30 text-emerald-400 hover:bg-emerald-500/25"
							: "bg-white/5 border-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/10"
					}`}
				>
					{/* YouTube loop ikonu: dikdörtgen oluşturan iki ok */}
					<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
						<title>
							{loopEnabled ? UI_LABELS.MUSIC_PLAYER.LOOP_ON : UI_LABELS.MUSIC_PLAYER.LOOP_OFF}
						</title>
						<path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v5z" />
					</svg>
				</button>
			</div>
		</div>
	);
}
