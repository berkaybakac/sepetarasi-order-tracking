import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UI_LABELS } from "../../../constants/labels";
import { ApiError, api } from "../../../lib/api";
import { logger } from "../../../lib/logger";
import { useMusicStore } from "../../../stores/musicStore";
import { useOrderStore } from "../../../stores/orderStore";
import { ActionButton, BaseAdminCard, BaseAdminCardSection, InlineAlert } from "../ui/primitives";

const SOUND_BARS: { key: string; style: CSSProperties }[] = [
	0.56, 0.84, 0.68, 1, 0.74, 0.9, 0.62,
].map((height, i) => ({
	key: `bar-${i + 1}`,
	style: {
		"--eq-dur": `${0.7 + i * 0.12}s`,
		animationDelay: `${i * 0.14}s`,
		height: `${Math.round(height * 100)}%`,
	} as CSSProperties,
}));

function getMusicPlayerLoadErrorMessage(error: unknown) {
	if (error instanceof ApiError) {
		if (error.code === "UNAUTHORIZED") {
			return UI_LABELS.MUSIC_PLAYER.LOAD_AUTH_ERROR;
		}

		if (error.code === "NETWORK_ERROR" || error.code === "TIMEOUT" || error.code === "ABORTED") {
			return UI_LABELS.MUSIC_PLAYER.LOAD_NETWORK_ERROR;
		}
	}

	return UI_LABELS.MUSIC_PLAYER.LOAD_ERROR;
}

export function MusicPlayerCard() {
	const status = useMusicStore((s) => s.status);
	const setStatus = useMusicStore((s) => s.setStatus);
	const lastReconnectedAt = useOrderStore((s) => s.lastReconnectedAt);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const mountedRef = useRef(true);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	const loadStatus = useCallback(async () => {
		setLoading(true);
		setLoadError(null);

		try {
			const nextStatus = await api.getMusicStatus();
			if (!mountedRef.current) return;
			setStatus(nextStatus);
		} catch (error) {
			if (!mountedRef.current) return;
			logger.error("MusicPlayerCard", "Failed to fetch music status.", error);
			setLoadError(getMusicPlayerLoadErrorMessage(error));
		} finally {
			if (mountedRef.current) setLoading(false);
		}
	}, [setStatus]);

	useEffect(() => {
		void loadStatus();
	}, [loadStatus]);

	useEffect(() => {
		if (lastReconnectedAt > 0 && loadError !== null) {
			void loadStatus();
		}
	}, [lastReconnectedAt, loadError, loadStatus]);

	const refreshStatus = useCallback(
		() =>
			api
				.getMusicStatus()
				.then(setStatus)
				.catch((error) =>
					logger.error("MusicPlayerCard", "Failed to refresh music status.", error),
				),
		[setStatus],
	);

	const controlsReady = !loading && !loadError && status !== null;

	const handlePlayPause = () => {
		if (!controlsReady) return;
		const action = status?.isPlaying ? api.musicPause() : api.musicPlay();
		action
			.then(refreshStatus)
			.catch((error) => logger.error("MusicPlayerCard", "Play/pause failed.", error));
	};

	const handleSkip = () => {
		if (!controlsReady) return;
		api
			.musicSkip()
			.then(refreshStatus)
			.catch((error) => logger.error("MusicPlayerCard", "Skip failed.", error));
	};

	const handlePrevious = () => {
		if (!controlsReady) return;
		api
			.musicPrevious()
			.then(refreshStatus)
			.catch((error) => logger.error("MusicPlayerCard", "Previous track failed.", error));
	};

	const handleToggleLoop = () => {
		if (!controlsReady) return;
		api
			.setMusicMode({ loop: !(status?.loop ?? true) })
			.then(refreshStatus)
			.catch((error) => logger.error("MusicPlayerCard", "Loop toggle failed.", error));
	};

	const handleToggleShuffle = () => {
		if (!controlsReady) return;
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

	const statusBadgeClass = useMemo(() => {
		if (!status) return "border-border-subtle bg-surface-1/45 text-text-subtle";
		if (status.isDucked) return "border-amber-400/20 bg-amber-500/10 text-amber-300";
		if (status.isPlaying) return "border-emerald-400/20 bg-emerald-500/10 text-emerald-300";
		if (status.isPaused) return "border-blue-400/20 bg-blue-500/10 text-blue-300";
		return "border-border-subtle bg-surface-1/45 text-text-subtle";
	}, [status]);

	const stageStatusClass = useMemo(() => {
		if (!status) return "text-text-subtle";
		if (status.isDucked) return "text-amber-300";
		if (status.isPlaying) return "text-emerald-300";
		if (status.isPaused) return "text-blue-300";
		return "text-text-subtle";
	}, [status]);

	const stageStatusDotClass = useMemo(() => {
		if (!status) return "bg-white/35";
		if (status.isDucked) return "bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.42)]";
		if (status.isPlaying) return "bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.45)]";
		if (status.isPaused) return "bg-blue-300 shadow-[0_0_12px_rgba(147,197,253,0.4)]";
		return "bg-white/35";
	}, [status]);

	const trackName = status?.currentTrackName ?? UI_LABELS.MUSIC_PLAYER.NO_TRACK;
	const showPause = status?.isPlaying ?? false;
	const loopEnabled = status?.loop ?? true;
	const shuffleEnabled = status?.shuffle ?? false;
	const animateStage = status?.isPlaying ?? false;

	return (
		<BaseAdminCard
			title={UI_LABELS.MUSIC_PLAYER.TITLE}
			icon={
				<svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
			}
			accent="emerald"
			actions={
				<span
					className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.14em] ${statusBadgeClass}`}
				>
					{statusLabel}
				</span>
			}
			bodyClassName="space-y-4"
		>
			{loading ? (
				<div className="flex min-h-[8rem] items-center justify-center">
					<div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white/80" />
				</div>
			) : loadError ? (
				<div className="space-y-4">
					<InlineAlert tone="danger">{loadError}</InlineAlert>
					<div className="flex justify-end">
						<ActionButton tone="secondary" onClick={() => void loadStatus()}>
							{UI_LABELS.MUSIC_PLAYER.RETRY_BUTTON}
						</ActionButton>
					</div>
				</div>
			) : (
				<>
					<BaseAdminCardSection className="px-4 py-4 sm:px-5">
						<div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
							<div className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-[1.35rem] border border-emerald-400/12 bg-[linear-gradient(145deg,rgba(16,185,129,0.12),rgba(9,18,31,0.78))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_24px_rgba(3,8,18,0.28)]">
								<div className="flex h-9 items-end gap-1">
									{SOUND_BARS.map(({ key, style }) => (
										<div
											key={key}
											className={`sound-bar w-1.5 rounded-full bg-gradient-to-t from-emerald-500 via-emerald-400 to-cyan-300 shadow-[0_0_12px_rgba(16,185,129,0.26)] ${
												animateStage ? "" : "opacity-45"
											}`}
											style={{
												...style,
												animation: animateStage ? undefined : "none",
												transform: animateStage ? undefined : "scaleY(0.55)",
											}}
										/>
									))}
								</div>
							</div>

							<div className="min-w-0 text-left">
								<p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-text-subtle">
									Seçili parça
								</p>
								<p
									className="mt-1 truncate text-xl font-semibold tracking-tight text-text-strong sm:text-[1.7rem]"
									title={trackName}
								>
									{trackName}
								</p>
								<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-medium">
									<span className={`inline-flex items-center gap-2 ${stageStatusClass}`}>
										<span className={`h-2 w-2 rounded-full ${stageStatusDotClass}`} />
										{statusLabel}
									</span>
								</div>
							</div>

							<div className="flex flex-col items-start gap-2 text-left lg:items-end lg:text-right">
								<p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-text-subtle">
									Çalma modu
								</p>
								<div className="flex flex-wrap items-center gap-2 lg:justify-end">
									{shuffleEnabled ? (
										<span className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-[0.72rem] font-medium text-cyan-200">
											{UI_LABELS.MUSIC_PLAYER.SHUFFLE_BADGE}
										</span>
									) : null}
									{loopEnabled ? (
										<span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[0.72rem] font-medium text-emerald-200">
											{UI_LABELS.MUSIC_PLAYER.LOOP_BADGE}
										</span>
									) : null}
									{!shuffleEnabled && !loopEnabled ? (
										<span className="inline-flex items-center rounded-full border border-border-subtle bg-surface-1/60 px-2.5 py-1 text-[0.72rem] font-medium text-text-muted">
											Standart akış
										</span>
									) : null}
								</div>
							</div>
						</div>
					</BaseAdminCardSection>

					{/* Kontrol Satırı: [karıştır] [önceki] [oynat/duraklat] [sonraki] [döngü] */}
					<BaseAdminCardSection className="p-3">
						<div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
							{/* Karışık Çal (Shuffle) */}
							<button
								type="button"
								onClick={handleToggleShuffle}
								disabled={!controlsReady}
								title={
									shuffleEnabled
										? UI_LABELS.MUSIC_PLAYER.SHUFFLE_ON
										: UI_LABELS.MUSIC_PLAYER.SHUFFLE_OFF
								}
								className={`p-2 rounded-xl border transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
									shuffleEnabled
										? "bg-cyan-500/15 border-cyan-400/30 text-cyan-400 hover:bg-cyan-500/25"
										: "border-border-subtle bg-surface-1/45 text-text-subtle hover:bg-white/10 hover:text-text-muted"
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
								disabled={!controlsReady}
								title={UI_LABELS.MUSIC_PLAYER.PREVIOUS}
								className="rounded-xl border border-border-subtle bg-surface-1/45 p-2.5 text-text-muted transition-all hover:bg-white/10 hover:text-text-strong disabled:cursor-not-allowed disabled:opacity-45"
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
								disabled={!controlsReady}
								title={showPause ? UI_LABELS.MUSIC_PLAYER.PAUSE : UI_LABELS.MUSIC_PLAYER.PLAY}
								className="p-3 rounded-2xl bg-gradient-to-br from-green-500 to-teal-500 hover:from-green-400 hover:to-teal-400 text-white shadow-lg shadow-green-500/20 transition-all disabled:cursor-not-allowed disabled:opacity-45"
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
								disabled={!controlsReady}
								title={UI_LABELS.MUSIC_PLAYER.SKIP}
								className="rounded-xl border border-border-subtle bg-surface-1/45 p-2.5 text-text-muted transition-all hover:bg-white/10 hover:text-text-strong disabled:cursor-not-allowed disabled:opacity-45"
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
								disabled={!controlsReady}
								title={
									loopEnabled ? UI_LABELS.MUSIC_PLAYER.LOOP_ON : UI_LABELS.MUSIC_PLAYER.LOOP_OFF
								}
								className={`p-2 rounded-xl border transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
									loopEnabled
										? "bg-emerald-500/15 border-emerald-400/30 text-emerald-400 hover:bg-emerald-500/25"
										: "border-border-subtle bg-surface-1/45 text-text-subtle hover:bg-white/10 hover:text-text-muted"
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
					</BaseAdminCardSection>
				</>
			)}
		</BaseAdminCard>
	);
}
