import { WS_CHANNELS, WS_EVENTS } from "@sepetarasi/shared";
import type { AnnouncementService } from "../services/announcement.service.js";
import type { AudioPlaybackService } from "../services/audio-playback.service.js";
import type { MusicPlayerService } from "../services/music-player.service.js";
import type { Broadcaster } from "../ws/broadcaster.js";

interface WorkerLogger {
	info: (obj: Record<string, unknown>, msg?: string) => void;
	error: (obj: Record<string, unknown>, msg?: string) => void;
}

function createFallbackWorkerLogger(): WorkerLogger {
	const isTestEnv = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
	if (isTestEnv) {
		return {
			info: () => undefined,
			error: () => undefined,
		};
	}

	return {
		info: (obj, msg = "announcement-worker") => {
			process.stdout.write(
				`${JSON.stringify({
					timestamp: new Date().toISOString(),
					level: "info",
					component: "announcement-worker",
					msg,
					...obj,
				})}\n`,
			);
		},
		error: (obj, msg = "announcement-worker") => {
			process.stderr.write(
				`${JSON.stringify({
					timestamp: new Date().toISOString(),
					level: "error",
					component: "announcement-worker",
					msg,
					...obj,
				})}\n`,
			);
		},
	};
}

export interface AnnouncementWorkerOptions {
	announcementService: AnnouncementService;
	broadcaster: Broadcaster;
	audioPlayer: AudioPlaybackService;
	musicPlayer?: MusicPlayerService;
	pollIntervalMs?: number;
	logger?: WorkerLogger;
}

export class AnnouncementWorker {
	private timer: ReturnType<typeof setInterval> | null = null;
	private processing = false;
	private service: AnnouncementService;
	private broadcaster: Broadcaster;
	private audioPlayer: AudioPlaybackService;
	private musicPlayer: MusicPlayerService | undefined;
	private pollIntervalMs: number;
	private logger: WorkerLogger;

	constructor(opts: AnnouncementWorkerOptions) {
		this.service = opts.announcementService;
		this.broadcaster = opts.broadcaster;
		this.audioPlayer = opts.audioPlayer;
		this.musicPlayer = opts.musicPlayer;
		this.pollIntervalMs = opts.pollIntervalMs ?? 1000;
		this.logger = opts.logger ?? createFallbackWorkerLogger();
	}

	start() {
		if (this.timer) return;
		this.timer = setInterval(() => this.poll(), this.pollIntervalMs);
	}

	stop() {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	/** Process one announcement if available */
	private async poll() {
		if (this.processing) return;
		this.processing = true;

		try {
			const item = this.service.getNextPending();
			if (!item) {
				this.processing = false;
				return;
			}

			this.logger.info(
				{
					event: "announcement.worker.play_started",
					announcementId: item.id,
					orderId: item.order_id,
					displayNo: item.display_no,
				},
				"Announcement playback started",
			);

			// Mark as playing + duck music (wait for fade) + broadcast
			this.service.markPlaying(item.id);
			await this.musicPlayer?.duck();
			this.broadcaster.broadcast(
				[WS_CHANNELS.ORDERS, WS_CHANNELS.DISPLAY],
				WS_EVENTS.ANNOUNCEMENT_NOW_PLAYING,
				{ order_id: item.order_id, display_no: item.display_no },
			);

			await this.audioPlayer.play(item.display_no);

			// Mark as played + restore music + broadcast
			this.service.markPlayed(item.id);
			this.musicPlayer?.unduck();
			this.broadcaster.broadcast(
				[WS_CHANNELS.ORDERS, WS_CHANNELS.DISPLAY],
				WS_EVENTS.ANNOUNCEMENT_FINISHED,
				{ order_id: item.order_id, display_no: item.display_no },
			);
			this.logger.info(
				{
					event: "announcement.worker.play_finished",
					announcementId: item.id,
					orderId: item.order_id,
					displayNo: item.display_no,
				},
				"Announcement playback finished",
			);
		} catch (err) {
			this.logger.error(
				{
					event: "announcement.worker.error",
					error: err instanceof Error ? err.message : String(err),
				},
				"Announcement worker error",
			);
		} finally {
			this.processing = false;
		}
	}

	/** Manually trigger one poll cycle (for testing) */
	async processOne() {
		await this.poll();
	}
}
