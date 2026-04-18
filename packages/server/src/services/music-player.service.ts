import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { SETTING_KEYS, WS_CHANNELS, WS_EVENTS } from "@sepetarasi/shared";
import type { MusicRuntimeIssue, MusicStatus, MusicTrackRecord } from "@sepetarasi/shared";
import { eq } from "drizzle-orm";
import type { AppDatabase } from "../db/connection.js";
import { appSettings, musicTracks } from "../db/schema.js";
import { detectAudioRuntimeSignals } from "../utils/audio-runtime-signals.js";
import type { Broadcaster } from "../ws/broadcaster.js";

interface MusicPlayerLogger {
	info: (obj: Record<string, unknown>, msg?: string) => void;
	warn: (obj: Record<string, unknown>, msg?: string) => void;
	error: (obj: Record<string, unknown>, msg?: string) => void;
}

function createFallbackLogger(): MusicPlayerLogger {
	const isTestEnv = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
	if (isTestEnv) {
		return { info: () => undefined, warn: () => undefined, error: () => undefined };
	}
	return {
		info: (obj, msg = "music-player") =>
			process.stdout.write(
				`${JSON.stringify({ timestamp: new Date().toISOString(), level: "info", component: "music-player", msg, ...obj })}\n`,
			),
		warn: (obj, msg = "music-player") =>
			process.stdout.write(
				`${JSON.stringify({ timestamp: new Date().toISOString(), level: "warn", component: "music-player", msg, ...obj })}\n`,
			),
		error: (obj, msg = "music-player") =>
			process.stderr.write(
				`${JSON.stringify({ timestamp: new Date().toISOString(), level: "error", component: "music-player", msg, ...obj })}\n`,
			),
	};
}

export interface MusicPlayerOptions {
	db: AppDatabase;
	broadcaster: Broadcaster;
	alsaDevice?: string;
	logger?: MusicPlayerLogger;
}

interface MusicPlayResult {
	ok: boolean;
	code?: string;
	message?: string;
	status: MusicStatus;
}

interface PlaybackBlocker {
	code: string;
	message: string;
}

interface PlaybackConfirmationWaiter {
	resolve: (confirmed: boolean) => void;
	timer: ReturnType<typeof setTimeout>;
}

/**
 * mpg123 remote mode VOLUME command accepts 0-100 percentage.
 * Clamp and round to integer.
 */
function clampVolume(volume: number): number {
	return Math.round(Math.max(0, Math.min(100, volume)));
}

// Soft fade steps: array of [volume%, delay_ms]
const DUCK_STEPS: [number, number][] = [
	[70, 0],
	[40, 60],
	[20, 60],
	[10, 60],
];
const UNDUCK_STEPS: [number, number][] = [
	[30, 500], // 500ms silence after announcement before fade-in
	[55, 120],
	[80, 120],
	[100, 120],
];

export class MusicPlayerService {
	private proc: ChildProcess | null = null;
	private playlist: MusicTrackRecord[] = [];
	private currentIndex = 0;
	private shuffleQueue: string[] = [];
	private shuffleHistory: string[] = [];
	private isPlaying = false;
	private isPaused = false;
	private isDucked = false;
	private runtimeIssue: MusicRuntimeIssue | null = null;
	private awaitingPlaybackConfirmation = false;
	private playbackConfirmationWaiters: PlaybackConfirmationWaiter[] = [];
	private stoppingProcess = false;
	private fadeTimers: ReturnType<typeof setTimeout>[] = [];
	private lastLoadAt = 0;
	private consecutiveLoadFailures = 0;
	private static readonly LOAD_FAIL_THRESHOLD_MS = 500;
	private static readonly MAX_CONSECUTIVE_FAILURES = 3;
	private static readonly PLAYBACK_CONFIRMATION_TIMEOUT_MS = 3000;

	private db: AppDatabase;
	private broadcaster: Broadcaster;
	private alsaDevice: string | undefined;
	private logger: MusicPlayerLogger;

	constructor(opts: MusicPlayerOptions) {
		this.db = opts.db;
		this.broadcaster = opts.broadcaster;
		this.alsaDevice = opts.alsaDevice;
		this.logger = opts.logger ?? createFallbackLogger();
	}

	// ── Public API ──────────────────────────────────────────────────────────

	start(): void {
		if (this.proc) return;
		this.clearRuntimeIssue();

		try {
			this.playlist = this.loadPlaylistFromDb();
		} catch (err) {
			this.setRuntimeIssue(
				"PLAYLIST_LOAD_FAILED",
				`Müzik listesi yüklenemedi: ${err instanceof Error ? err.message : String(err)}`,
			);
			this.logger.error(
				{ event: "music.start.db_error", error: err instanceof Error ? err.message : String(err) },
				"Music player failed to load playlist from DB — skipping startup (migration missing?)",
			);
			this.broadcastStatus();
			return;
		}

		const enabled = this.getEnabled();
		if (!enabled || this.playlist.length === 0) {
			this.logger.info(
				{ event: "music.start.skipped", enabled, tracks: this.playlist.length },
				"Music player not started",
			);
			return;
		}

		this.currentIndex = this.resolveStartIndex();
		this.syncShuffleState();
		this.spawnProcess();
	}

	stop(): void {
		this.consecutiveLoadFailures = 0;
		this.clearFadeTimers();
		this.isDucked = false;
		this.awaitingPlaybackConfirmation = false;
		this.resolvePlaybackConfirmationWaiters(false);

		if (!this.proc) {
			this.isPlaying = false;
			this.isPaused = false;
			this.broadcastStatus();
			return;
		}

		this.stoppingProcess = true;
		this.sendCommand("STOP");
		this.sendCommand("QUIT");
		setTimeout(() => {
			if (this.proc && !this.proc.killed) this.proc.kill();
			this.proc = null;
		}, 300);
		this.isPlaying = false;
		this.isPaused = false;
		this.broadcastStatus();
	}

	play(): void {
		if (!this.proc) {
			// Process may not have started if music was disabled at boot
			this.start();
			this.broadcastStatus();
			return;
		}
		if (this.isPaused) {
			this.sendCommand("PAUSE"); // toggle resume
			this.isPaused = false;
			this.isPlaying = true;
			this.awaitingPlaybackConfirmation = true;
		} else if (!this.isPlaying) {
			this.loadCurrentTrack();
		}
		this.broadcastStatus();
	}

	async playAndVerify(
		timeoutMs = MusicPlayerService.PLAYBACK_CONFIRMATION_TIMEOUT_MS,
	): Promise<MusicPlayResult> {
		const blocker = this.getPlaybackBlocker();
		if (blocker) {
			this.setRuntimeIssue(blocker.code, blocker.message);
			this.broadcastStatus();
			return {
				ok: false,
				code: blocker.code,
				message: blocker.message,
				status: this.getStatus(),
			};
		}

		this.play();

		if (!this.awaitingPlaybackConfirmation) {
			if (this.isPlaying && !this.isPaused) {
				return { ok: true, status: this.getStatus() };
			}
			const issue = this.ensureRuntimeIssue(
				"PLAYBACK_NOT_CONFIRMED",
				"Müzik oynatma başlatıldı ama doğrulanamadı.",
			);
			this.broadcastStatus();
			return {
				ok: false,
				code: issue.code,
				message: issue.message,
				status: this.getStatus(),
			};
		}

		const confirmed = await this.waitForPlaybackConfirmation(timeoutMs);
		if (confirmed) {
			return { ok: true, status: this.getStatus() };
		}

		const issue = this.ensureRuntimeIssue(
			"PLAYBACK_NOT_CONFIRMED",
			"Müzik oynatma başlatıldı ama doğrulanamadı.",
		);
		this.broadcastStatus();
		return {
			ok: false,
			code: issue.code,
			message: issue.message,
			status: this.getStatus(),
		};
	}

	pause(): void {
		if (!this.proc || (!this.isPlaying && !this.isPaused)) return;
		this.sendCommand("PAUSE");
		this.isPaused = !this.isPaused;
		this.isPlaying = !this.isPaused;
		this.broadcastStatus();
	}

	skip(): void {
		if (this.playlist.length === 0) return;
		this.currentIndex = this.resolveManualNextIndex();
		this.persistCurrentTrack();
		if (this.proc && !this.isDucked) {
			this.loadCurrentTrack();
		}
		this.broadcastStatus();
	}

	previous(): void {
		if (this.playlist.length === 0) return;
		if (this.getShuffleEnabled()) {
			this.currentIndex = this.resolveManualPreviousIndex();
		} else {
			this.currentIndex = this.currentIndex > 0 ? this.currentIndex - 1 : this.playlist.length - 1;
		}
		this.persistCurrentTrack();
		if (this.proc && !this.isDucked) {
			this.loadCurrentTrack();
		}
		this.broadcastStatus();
	}

	setEnabled(enabled: boolean): void {
		if (enabled) {
			this.start();
			this.broadcastStatus();
		} else {
			this.stop();
		}
	}

	setLoop(_loopEnabled: boolean): void {
		this.broadcastStatus();
	}

	setShuffle(shuffleEnabled: boolean): void {
		if (shuffleEnabled) {
			this.syncShuffleState();
		} else {
			this.clearShuffleState();
		}
		this.broadcastStatus();
	}

	/**
	 * Soft duck: gradually lower music volume over ~180ms.
	 * Returns a promise that resolves when fade completes so the announcement
	 * waits for music to be quiet before speaking.
	 */
	duck(): Promise<void> {
		if (!this.proc || !this.isPlaying || this.isDucked) return Promise.resolve();
		this.isDucked = true;
		this.clearFadeTimers();

		const baseVolume = this.getMusicVolume();
		let totalDelay = 0;
		for (const [pct, delay] of DUCK_STEPS) {
			totalDelay += delay;
			const targetVol = Math.round((baseVolume * pct) / 100);
			const d = totalDelay;
			this.fadeTimers.push(
				setTimeout(() => {
					if (this.isDucked && this.proc) {
						this.sendCommand(`VOLUME ${clampVolume(targetVol)}`);
					}
				}, d),
			);
		}
		this.logger.info({ event: "music.duck", baseVolume }, "Music ducked for announcement");
		return new Promise((resolve) => {
			this.fadeTimers.push(setTimeout(resolve, totalDelay + 50));
		});
	}

	/**
	 * Soft unduck: wait 500ms then gradually restore music volume over ~360ms.
	 * Fire-and-forget — announcement is already done, no need to await.
	 */
	unduck(): void {
		if (!this.proc || !this.isDucked) return;
		this.isDucked = false;
		this.clearFadeTimers();

		const baseVolume = this.getMusicVolume();
		let totalDelay = 0;
		for (const [pct, delay] of UNDUCK_STEPS) {
			totalDelay += delay;
			const targetVol = Math.round((baseVolume * pct) / 100);
			const d = totalDelay;
			this.fadeTimers.push(
				setTimeout(() => {
					if (!this.isDucked && this.proc) {
						this.sendCommand(`VOLUME ${clampVolume(targetVol)}`);
					}
				}, d),
			);
		}
		this.logger.info({ event: "music.unduck", baseVolume }, "Music unducked after announcement");
	}

	private clearFadeTimers(): void {
		for (const t of this.fadeTimers) clearTimeout(t);
		this.fadeTimers = [];
	}

	setVolume(volume: number): void {
		if (!this.proc || this.isDucked) return;
		this.sendCommand(`VOLUME ${clampVolume(volume)}`);
		this.broadcastStatus();
	}

	/** Called after upload or delete to refresh playlist without restart */
	reloadPlaylist(): void {
		const oldTrackId = this.getCurrentTrackId();
		try {
			this.playlist = this.loadPlaylistFromDb();
		} catch (err) {
			this.logger.error(
				{ event: "music.reload.db_error", error: err instanceof Error ? err.message : String(err) },
				"Failed to reload playlist from DB",
			);
			return;
		}

		if (this.playlist.length === 0) {
			this.stop();
			return;
		}

		// Try to keep current track position
		const newIndex = this.playlist.findIndex((t) => t.id === oldTrackId);
		this.currentIndex = newIndex >= 0 ? newIndex : 0;
		this.syncShuffleState();
		this.broadcastStatus();
	}

	getStatus(): MusicStatus {
		const current = this.playlist[this.currentIndex] ?? null;
		return {
			isPlaying: this.isPlaying,
			isPaused: this.isPaused,
			isDucked: this.isDucked,
			currentTrackId: current?.id ?? null,
			currentTrackName: current?.display_name ?? null,
			volume: this.getMusicVolume(),
			enabled: this.getEnabled(),
			loop: this.getLoopEnabled(),
			shuffle: this.getShuffleEnabled(),
			runtimeIssue: this.runtimeIssue,
		};
	}

	// ── Private helpers ──────────────────────────────────────────────────────

	private spawnProcess(): void {
		const args = ["-R", "-q"];
		if (this.alsaDevice) args.push("-a", this.alsaDevice);

		this.logger.info({ event: "music.process.spawn", args }, "Spawning mpg123 remote process");

		this.stoppingProcess = false;
		this.proc = spawn("mpg123", args, { stdio: ["pipe", "pipe", "pipe"] });

		this.proc.stdin?.on("error", (err) => {
			this.logger.warn(
				{ event: "music.stdin.error", error: (err as NodeJS.ErrnoException).code ?? String(err) },
				"mpg123 stdin error (process likely died)",
			);
		});

		this.proc.stderr?.on("data", (chunk: Buffer) => {
			const text = chunk.toString().trim();
			if (text) {
				const signals = detectAudioRuntimeSignals(text);
				this.logger.warn(
					{
						event: "music.mpg123.stderr",
						output: text,
						signals: signals.length > 0 ? signals : undefined,
					},
					"mpg123 stderr",
				);
				if (signals.length > 0 || this.awaitingPlaybackConfirmation) {
					this.setRuntimeIssue(signals[0]?.toUpperCase() ?? "PLAYER_STDERR", text, signals);
					this.broadcastStatus();
				}
			}
		});

		this.proc.on("error", (err) => {
			this.setRuntimeIssue("PLAYER_PROCESS_ERROR", `mpg123 process error: ${err.message}`);
			this.logger.error(
				{ event: "music.process.error", error: err.message },
				"mpg123 process error",
			);
			this.proc = null;
			this.isPlaying = false;
			this.isPaused = false;
			this.awaitingPlaybackConfirmation = false;
			this.resolvePlaybackConfirmationWaiters(false);
			this.broadcastStatus();
		});

		this.proc.on("close", (code) => {
			const intentionalStop = this.stoppingProcess;
			this.stoppingProcess = false;
			this.logger.info({ event: "music.process.closed", code }, "mpg123 process closed");
			this.proc = null;
			this.isPlaying = false;
			this.isPaused = false;
			this.awaitingPlaybackConfirmation = false;
			this.resolvePlaybackConfirmationWaiters(false);
			if (!intentionalStop && code !== 0 && !this.runtimeIssue) {
				this.setRuntimeIssue(
					"PLAYER_PROCESS_CLOSED",
					`mpg123 beklenmedik şekilde kapandı (exit code: ${code ?? "unknown"}).`,
				);
			}
			this.broadcastStatus();
		});

		// Parse stdout for @P status lines
		let buffer = "";
		this.proc.stdout?.on("data", (chunk: Buffer) => {
			buffer += chunk.toString();
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";
			for (const line of lines) {
				this.handleMpg123Line(line.trim());
			}
		});

		// Set initial volume and start first track
		const volume = this.getMusicVolume();
		this.sendCommand(`VOLUME ${clampVolume(volume)}`);
		this.loadCurrentTrack();
	}

	private handleMpg123Line(line: string): void {
		if (!line.startsWith("@")) return;

		if (line.startsWith("@P 0")) {
			this.isPlaying = false;
			if (this.isDucked || this.playlist.length === 0) return;

			const elapsed = Date.now() - this.lastLoadAt;
			if (elapsed < MusicPlayerService.LOAD_FAIL_THRESHOLD_MS) {
				this.consecutiveLoadFailures += 1;
				const failedTrack = this.playlist[this.currentIndex];
				this.setRuntimeIssue(
					"TRACK_LOAD_FAILED",
					`Parça yüklenemedi: ${failedTrack?.display_name ?? "bilinmeyen parça"}`,
				);
				this.logger.error(
					{
						event: "music.track.load_failed",
						trackId: failedTrack?.id,
						name: failedTrack?.display_name,
						path: failedTrack?.file_path,
						elapsedMs: elapsed,
						failures: this.consecutiveLoadFailures,
					},
					"mpg123 stopped immediately after LOAD — likely missing file or decode error",
				);
				if (this.consecutiveLoadFailures >= MusicPlayerService.MAX_CONSECUTIVE_FAILURES) {
					this.logger.error(
						{ event: "music.player.halted", failures: this.consecutiveLoadFailures },
						"Too many consecutive load failures — halting music player",
					);
					this.stop();
					return;
				}
				const nextIndex = this.resolveNextIndex();
				if (nextIndex === null) {
					this.stop();
					return;
				}
				this.currentIndex = nextIndex;
				this.persistCurrentTrack();
				this.loadCurrentTrack();
				return;
			}

			// Normal end-of-track: advance and reset failure counter
			this.consecutiveLoadFailures = 0;
			const nextIndex = this.resolveNextIndex();
			if (nextIndex === null) {
				this.isPlaying = false;
				this.isPaused = false;
				this.awaitingPlaybackConfirmation = false;
				this.broadcastStatus();
				return;
			}
			this.currentIndex = nextIndex;
			this.persistCurrentTrack();
			this.loadCurrentTrack();
		} else if (line.startsWith("@P 1")) {
			this.isPaused = true;
			this.isPlaying = false;
			this.broadcastStatus();
		} else if (line.startsWith("@P 2")) {
			this.isPaused = false;
			this.isPlaying = true;
			this.awaitingPlaybackConfirmation = false;
			this.clearRuntimeIssue();
			this.resolvePlaybackConfirmationWaiters(true);
			this.broadcastStatus();
		}
	}

	private loadCurrentTrack(): void {
		while (this.playlist.length > 0) {
			const track = this.playlist[this.currentIndex];
			if (!track) {
				this.currentIndex = 0;
				continue;
			}

			if (!existsSync(track.file_path)) {
				this.logger.warn(
					{
						event: "music.track.file_missing",
						trackId: track.id,
						name: track.display_name,
						path: track.file_path,
					},
					"Music track file is missing at load time; removing from runtime playlist",
				);
				this.removeTrackFromShuffleState(track.id);
				this.playlist.splice(this.currentIndex, 1);
				if (this.currentIndex >= this.playlist.length) {
					this.currentIndex = 0;
				}
				continue;
			}

			this.lastLoadAt = Date.now();
			this.awaitingPlaybackConfirmation = true;
			this.sendCommand(`LOAD ${track.file_path}`);
			this.isPlaying = true;
			this.isPaused = false;
			this.persistCurrentTrack();
			this.logger.info(
				{
					event: "music.track.load",
					trackId: track.id,
					name: track.display_name,
					durationSeconds: track.duration_seconds,
					path: track.file_path,
				},
				"Loading track",
			);
			return;
		}

		this.setRuntimeIssue("NO_PLAYABLE_TRACKS", "Çalınabilir müzik parçası bulunamadı.");
		this.logger.warn(
			{ event: "music.playlist.empty_runtime" },
			"No playable tracks remain in runtime playlist",
		);
		this.stop();
	}

	private sendCommand(cmd: string): void {
		if (!this.proc?.stdin?.writable) return;
		try {
			this.proc.stdin.write(`${cmd}\n`);
		} catch (err) {
			this.logger.warn(
				{ event: "music.command.failed", cmd, error: String(err) },
				"Failed to send mpg123 command",
			);
		}
	}

	private loadPlaylistFromDb(): MusicTrackRecord[] {
		const tracks = this.db
			.select()
			.from(musicTracks)
			.orderBy(musicTracks.sort_order, musicTracks.uploaded_at)
			.all() as MusicTrackRecord[];
		if (tracks.length === 0) {
			return tracks;
		}

		const playableTracks: MusicTrackRecord[] = [];
		const missingTracks: Array<Pick<MusicTrackRecord, "id" | "display_name" | "file_path">> = [];
		for (const track of tracks) {
			if (existsSync(track.file_path)) {
				playableTracks.push(track);
				continue;
			}
			missingTracks.push({
				id: track.id,
				display_name: track.display_name,
				file_path: track.file_path,
			});
		}

		if (missingTracks.length > 0) {
			this.logger.warn(
				{
					event: "music.playlist.missing_files",
					missingTrackCount: missingTracks.length,
					playableTrackCount: playableTracks.length,
					missingTracks,
				},
				"Music playlist contains missing files; unavailable tracks were skipped",
			);
		}

		return playableTracks;
	}

	private resolveStartIndex(): number {
		const savedId = this.db
			.select()
			.from(appSettings)
			.where(eq(appSettings.key, SETTING_KEYS.MUSIC_CURRENT_TRACK_ID))
			.get()?.value;

		if (savedId) {
			const idx = this.playlist.findIndex((t) => t.id === savedId);
			if (idx >= 0) return idx;
		}
		return 0;
	}

	private syncShuffleState(): void {
		if (!this.getShuffleEnabled() || this.playlist.length === 0) {
			this.clearShuffleState();
			return;
		}

		this.shuffleQueue = this.buildShuffleQueue(this.getCurrentTrackId());
		this.shuffleHistory = [];
	}

	private clearShuffleState(): void {
		this.shuffleQueue = [];
		this.shuffleHistory = [];
	}

	private buildShuffleQueue(excludeTrackId: string | null): string[] {
		const queue = this.playlist
			.map((track) => track.id)
			.filter((trackId) => trackId !== excludeTrackId);

		for (let i = queue.length - 1; i > 0; i -= 1) {
			const j = Math.floor(Math.random() * (i + 1));
			[queue[i], queue[j]] = [queue[j], queue[i]];
		}

		return queue;
	}

	private removeTrackFromShuffleState(trackId: string): void {
		this.shuffleQueue = this.shuffleQueue.filter((queuedTrackId) => queuedTrackId !== trackId);
		this.shuffleHistory = this.shuffleHistory.filter(
			(historyTrackId) => historyTrackId !== trackId,
		);
	}

	private persistCurrentTrack(): void {
		const trackId = this.getCurrentTrackId();
		if (!trackId) return;
		try {
			this.db
				.insert(appSettings)
				.values({
					key: SETTING_KEYS.MUSIC_CURRENT_TRACK_ID,
					value: trackId,
					updated_at: new Date().toISOString(),
				})
				.onConflictDoUpdate({
					target: appSettings.key,
					set: { value: trackId, updated_at: new Date().toISOString() },
				})
				.run();
		} catch (err) {
			this.logger.warn(
				{ event: "music.persist.failed", error: String(err) },
				"Failed to persist current track",
			);
		}
	}

	private getCurrentTrackId(): string | null {
		return this.playlist[this.currentIndex]?.id ?? null;
	}

	private getMusicVolume(): number {
		const row = this.db
			.select()
			.from(appSettings)
			.where(eq(appSettings.key, SETTING_KEYS.MUSIC_VOLUME))
			.get();
		return row ? Math.max(0, Math.min(100, Number(row.value))) : 60;
	}

	private getEnabled(): boolean {
		const row = this.db
			.select()
			.from(appSettings)
			.where(eq(appSettings.key, SETTING_KEYS.MUSIC_ENABLED))
			.get();
		return row?.value === "1";
	}

	private getLoopEnabled(): boolean {
		const row = this.db
			.select()
			.from(appSettings)
			.where(eq(appSettings.key, SETTING_KEYS.MUSIC_LOOP_ENABLED))
			.get();
		return row ? row.value === "1" : true;
	}

	private getShuffleEnabled(): boolean {
		const row = this.db
			.select()
			.from(appSettings)
			.where(eq(appSettings.key, SETTING_KEYS.MUSIC_SHUFFLE_ENABLED))
			.get();
		return row?.value === "1";
	}

	private getNextShuffleIndex(allowCycleReset: boolean): number | null {
		if (this.playlist.length === 0) return null;
		if (this.playlist.length === 1) return allowCycleReset ? this.currentIndex : null;

		let startedNewCycle = false;
		while (true) {
			let nextTrackId = this.shuffleQueue.shift() ?? null;
			if (!nextTrackId) {
				if (!allowCycleReset) return null;
				this.shuffleHistory = [];
				this.shuffleQueue = this.buildShuffleQueue(this.getCurrentTrackId());
				startedNewCycle = true;
				nextTrackId = this.shuffleQueue.shift() ?? null;
				if (!nextTrackId) {
					return this.currentIndex;
				}
			}

			const nextIndex = this.playlist.findIndex((track) => track.id === nextTrackId);
			if (nextIndex < 0) {
				continue;
			}

			const currentTrackId = this.getCurrentTrackId();
			if (!startedNewCycle && currentTrackId && currentTrackId !== nextTrackId) {
				this.shuffleHistory.push(currentTrackId);
			}
			return nextIndex;
		}
	}

	private pickRandomIndexExcludingCurrent(): number {
		if (this.playlist.length <= 1) return this.currentIndex;
		let next = this.currentIndex;
		while (next === this.currentIndex) {
			next = Math.floor(Math.random() * this.playlist.length);
		}
		return next;
	}

	private resolveNextIndex(): number | null {
		if (this.playlist.length === 0) return null;
		if (this.getShuffleEnabled()) {
			return this.getNextShuffleIndex(this.getLoopEnabled());
		}

		const next = this.currentIndex + 1;
		if (next < this.playlist.length) return next;
		return this.getLoopEnabled() ? 0 : null;
	}

	// Manual skip always wraps at the end of the playlist; the loop setting only
	// controls automatic end-of-track behavior, keeping manual next symmetrical
	// with previous().
	private resolveManualNextIndex(): number {
		if (this.playlist.length === 0) return 0;
		if (this.getShuffleEnabled()) {
			return this.getNextShuffleIndex(true) ?? this.currentIndex;
		}

		const next = this.currentIndex + 1;
		return next < this.playlist.length ? next : 0;
	}

	private resolveManualPreviousIndex(): number {
		const currentTrackId = this.getCurrentTrackId();
		while (this.shuffleHistory.length > 0) {
			const previousTrackId = this.shuffleHistory.pop();
			if (!previousTrackId) break;

			const previousIndex = this.playlist.findIndex((track) => track.id === previousTrackId);
			if (previousIndex < 0) {
				continue;
			}

			if (currentTrackId && currentTrackId !== previousTrackId) {
				this.shuffleQueue = [
					currentTrackId,
					...this.shuffleQueue.filter((queuedTrackId) => queuedTrackId !== currentTrackId),
				];
			}
			return previousIndex;
		}

		return this.pickRandomIndexExcludingCurrent();
	}

	private tryRefreshPlaylistForIdle(): PlaybackBlocker | null {
		try {
			this.playlist = this.loadPlaylistFromDb();
			this.currentIndex = this.playlist.length > 0 ? this.resolveStartIndex() : 0;
			this.syncShuffleState();
			return null;
		} catch (err) {
			return {
				code: "PLAYLIST_LOAD_FAILED",
				message: `Müzik listesi yüklenemedi: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
	}

	private getPlaybackBlocker(): PlaybackBlocker | null {
		if (!this.getEnabled()) {
			return {
				code: "MUSIC_DISABLED",
				message: "Müzik kapalı. Oynatmadan önce müziği açın.",
			};
		}

		if (!this.proc) {
			const blocker = this.tryRefreshPlaylistForIdle();
			if (blocker) return blocker;
		}

		if (this.playlist.length === 0) {
			return {
				code: "NO_PLAYABLE_TRACKS",
				message: "Çalınabilir müzik parçası bulunamadı.",
			};
		}

		return null;
	}

	private waitForPlaybackConfirmation(timeoutMs: number): Promise<boolean> {
		if (!this.awaitingPlaybackConfirmation) {
			return Promise.resolve(this.isPlaying && !this.isPaused);
		}

		return new Promise((resolve) => {
			const waiter: PlaybackConfirmationWaiter = {
				resolve,
				timer: setTimeout(() => {
					this.playbackConfirmationWaiters = this.playbackConfirmationWaiters.filter(
						(entry) => entry !== waiter,
					);
					resolve(false);
				}, timeoutMs),
			};
			this.playbackConfirmationWaiters.push(waiter);
		});
	}

	private resolvePlaybackConfirmationWaiters(confirmed: boolean): void {
		for (const waiter of this.playbackConfirmationWaiters) {
			clearTimeout(waiter.timer);
			waiter.resolve(confirmed);
		}
		this.playbackConfirmationWaiters = [];
	}

	private setRuntimeIssue(code: string, message: string, signals: string[] = []): void {
		this.runtimeIssue = {
			code,
			message,
			at: new Date().toISOString(),
			signals,
		};
	}

	private ensureRuntimeIssue(
		code: string,
		message: string,
		signals: string[] = [],
	): MusicRuntimeIssue {
		if (!this.runtimeIssue) {
			this.setRuntimeIssue(code, message, signals);
		}
		return this.runtimeIssue as MusicRuntimeIssue;
	}

	private clearRuntimeIssue(): void {
		this.runtimeIssue = null;
	}

	private broadcastStatus(): void {
		try {
			this.broadcaster.broadcast(
				[WS_CHANNELS.ORDERS],
				WS_EVENTS.MUSIC_STATUS_CHANGED,
				this.getStatus(),
			);
		} catch (_err) {
			// Non-critical: WS broadcast failure should not crash the player
		}
	}
}
