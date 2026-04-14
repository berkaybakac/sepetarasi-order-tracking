import { useEffect } from "react";
import { UI_LABELS } from "../../../constants/labels";
import { api } from "../../../lib/api";
import { useMusicStore } from "../../../stores/musicStore";

export function MusicPlayerCard() {
	const status = useMusicStore((s) => s.status);
	const setStatus = useMusicStore((s) => s.setStatus);

	// Poll status on mount
	useEffect(() => {
		api
			.getMusicStatus()
			.then(setStatus)
			.catch((err) => console.error("[MusicPlayerCard] getMusicStatus failed:", err));
	}, [setStatus]);

	const handlePlay = () => {
		api
			.musicPlay()
			.then(() => api.getMusicStatus().then(setStatus))
			.catch(console.error);
	};

	const handlePause = () => {
		api
			.musicPause()
			.then(() => api.getMusicStatus().then(setStatus))
			.catch(console.error);
	};

	const handleSkip = () => {
		api
			.musicSkip()
			.then(() => api.getMusicStatus().then(setStatus))
			.catch(console.error);
	};

	const handlePrevious = () => {
		api
			.musicPrevious()
			.then(() => api.getMusicStatus().then(setStatus))
			.catch(console.error);
	};

	const statusLabel = (() => {
		if (!status) return "—";
		if (status.isDucked) return UI_LABELS.MUSIC_PLAYER.DUCKED;
		if (status.isPlaying) return UI_LABELS.MUSIC_PLAYER.NOW_PLAYING;
		if (status.isPaused) return UI_LABELS.MUSIC_PLAYER.PAUSED;
		return UI_LABELS.MUSIC_PLAYER.STOPPED;
	})();

	const statusColor = (() => {
		if (!status) return "text-slate-500";
		if (status.isDucked) return "text-amber-400";
		if (status.isPlaying) return "text-brand-success";
		if (status.isPaused) return "text-blue-400";
		return "text-slate-500";
	})();

	const trackName = status?.currentTrackName ?? UI_LABELS.MUSIC_PLAYER.NO_TRACK;
	const isPlayingOrPaused = status?.isPlaying || status?.isPaused;

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

			{/* Track name */}
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

			{/* Controls */}
			<div className="relative z-10 flex items-center justify-center gap-3">
				<button
					type="button"
					onClick={handlePrevious}
					title={UI_LABELS.MUSIC_PLAYER.PREVIOUS}
					className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 hover:text-white transition-all"
				>
					<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<title>{UI_LABELS.MUSIC_PLAYER.PREVIOUS}</title>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
						/>
					</svg>
				</button>

				{/* Play / Pause */}
				{isPlayingOrPaused ? (
					<button
						type="button"
						onClick={handlePause}
						title={UI_LABELS.MUSIC_PLAYER.PAUSE}
						className="p-3 rounded-2xl bg-gradient-to-br from-green-500 to-teal-500 hover:from-green-400 hover:to-teal-400 text-white shadow-lg shadow-green-500/20 transition-all"
					>
						<svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
							<title>{UI_LABELS.MUSIC_PLAYER.PAUSE}</title>
							<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
						</svg>
					</button>
				) : (
					<button
						type="button"
						onClick={handlePlay}
						title={UI_LABELS.MUSIC_PLAYER.PLAY}
						className="p-3 rounded-2xl bg-gradient-to-br from-green-500 to-teal-500 hover:from-green-400 hover:to-teal-400 text-white shadow-lg shadow-green-500/20 transition-all"
					>
						<svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
							<title>{UI_LABELS.MUSIC_PLAYER.PLAY}</title>
							<path d="M8 5v14l11-7z" />
						</svg>
					</button>
				)}

				<button
					type="button"
					onClick={handleSkip}
					title={UI_LABELS.MUSIC_PLAYER.SKIP}
					className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 hover:text-white transition-all"
				>
					<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<title>{UI_LABELS.MUSIC_PLAYER.SKIP}</title>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M13 5l7 7-7 7M5 5l7 7-7 7"
						/>
					</svg>
				</button>
			</div>
		</div>
	);
}
