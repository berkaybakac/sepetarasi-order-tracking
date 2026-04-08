import { WS_CHANNELS, WS_EVENTS } from "@sepetarasi/shared";
import type { FastifyBaseLogger } from "fastify";
import type { AnnouncementService } from "../services/announcement.service.js";
import type { AudioPlaybackService } from "../services/audio-playback.service.js";
import type { Broadcaster } from "../ws/broadcaster.js";

export interface AnnouncementWorkerOptions {
	announcementService: AnnouncementService;
	broadcaster: Broadcaster;
	audioPlayer: AudioPlaybackService;
	pollIntervalMs?: number;
	logger?: FastifyBaseLogger;
}

export class AnnouncementWorker {
	private timer: ReturnType<typeof setInterval> | null = null;
	private processing = false;
	private service: AnnouncementService;
	private broadcaster: Broadcaster;
	private audioPlayer: AudioPlaybackService;
	private pollIntervalMs: number;
	private logger: FastifyBaseLogger | Console;

	constructor(opts: AnnouncementWorkerOptions) {
		this.service = opts.announcementService;
		this.broadcaster = opts.broadcaster;
		this.audioPlayer = opts.audioPlayer;
		this.pollIntervalMs = opts.pollIntervalMs ?? 1000;
		this.logger = opts.logger ?? console;
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

			// Mark as playing + broadcast
			this.service.markPlaying(item.id);
			this.broadcaster.broadcast(
				[WS_CHANNELS.ORDERS, WS_CHANNELS.DISPLAY],
				WS_EVENTS.ANNOUNCEMENT_NOW_PLAYING,
				{ order_id: item.order_id, display_no: item.display_no },
			);

			await this.audioPlayer.play(item.display_no);

			// Mark as played + broadcast
			this.service.markPlayed(item.id);
			this.broadcaster.broadcast(
				[WS_CHANNELS.ORDERS, WS_CHANNELS.DISPLAY],
				WS_EVENTS.ANNOUNCEMENT_FINISHED,
				{ order_id: item.order_id, display_no: item.display_no },
			);
		} catch (err) {
			this.logger.error({ err }, "Announcement worker error");
		} finally {
			this.processing = false;
		}
	}

	/** Manually trigger one poll cycle (for testing) */
	async processOne() {
		await this.poll();
	}
}
