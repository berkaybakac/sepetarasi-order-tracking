import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { WS_CHANNELS, WS_EVENTS } from "@sepetarasi/shared";
import type { AnnouncementService } from "../services/announcement.service.js";
import type { Broadcaster } from "../ws/broadcaster.js";

export interface AnnouncementWorkerOptions {
	announcementService: AnnouncementService;
	broadcaster: Broadcaster;
	delayMs?: number;
	pollIntervalMs?: number;
	/** Disable audio playback (useful for tests) */
	disableAudio?: boolean;
	/**
	 * Directory containing pre-recorded MP3 files named {display_no}.mp3
	 * Falls back to TTS (espeak-ng/say) if file not found.
	 */
	announcementsPath?: string;
}

export class AnnouncementWorker {
	private timer: ReturnType<typeof setInterval> | null = null;
	private processing = false;
	private service: AnnouncementService;
	private broadcaster: Broadcaster;
	private delayMs: number;
	private pollIntervalMs: number;
	private disableAudio: boolean;
	private announcementsPath: string;

	constructor(opts: AnnouncementWorkerOptions) {
		this.service = opts.announcementService;
		this.broadcaster = opts.broadcaster;
		this.delayMs = opts.delayMs ?? 2500;
		this.pollIntervalMs = opts.pollIntervalMs ?? 1000;
		this.disableAudio = opts.disableAudio ?? false;
		this.announcementsPath =
			opts.announcementsPath ??
			join(process.cwd(), "packages", "server", "assets", "announcements");
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

			// Play audio announcement (or wait delayMs if audio disabled/unavailable)
			await this.playAudio(item.display_no);

			// Mark as played + broadcast
			this.service.markPlayed(item.id);
			this.broadcaster.broadcast(
				[WS_CHANNELS.ORDERS, WS_CHANNELS.DISPLAY],
				WS_EVENTS.ANNOUNCEMENT_FINISHED,
				{ order_id: item.order_id, display_no: item.display_no },
			);
		} catch (err) {
			console.error("Announcement worker error:", err);
		} finally {
			this.processing = false;
		}
	}

	/**
	 * Play announcement audio for the given order number.
	 *
	 * Priority:
	 * 1. Pre-recorded MP3 file: {announcementsPath}/{displayNo}.mp3  (best quality)
	 *    - Linux: mpg123   macOS: afplay
	 * 2. TTS fallback: espeak-ng (Linux) / say (macOS)
	 * 3. Silent timer fallback: if no audio command available
	 */
	private async playAudio(displayNo: number): Promise<void> {
		if (this.disableAudio) {
			await new Promise<void>((resolve) => setTimeout(resolve, this.delayMs));
			return;
		}

		const audioFile = join(this.announcementsPath, `${displayNo}.mp3`);
		if (existsSync(audioFile)) {
			const played = await this.playFile(audioFile);
			if (played) return;
		}

		// Fallback to TTS
		await this.playTts(displayNo);
	}

	/** Play a pre-recorded MP3 file. Returns true if successful, false if command unavailable. */
	private async playFile(filePath: string): Promise<boolean> {
		const isLinux = process.platform === "linux";
		const cmd = isLinux ? "mpg123" : "afplay";
		const args = isLinux ? ["-q", filePath] : [filePath];

		return new Promise<boolean>((resolve) => {
			const proc = spawn(cmd, args, { stdio: "ignore" });

			const safetyTimeout = setTimeout(() => {
				proc.kill();
				resolve(true);
			}, this.delayMs + 5000);

			proc.on("close", () => {
				clearTimeout(safetyTimeout);
				resolve(true);
			});

			proc.on("error", () => {
				clearTimeout(safetyTimeout);
				resolve(false); // command not found, caller will try TTS
			});
		});
	}

	/** TTS fallback: espeak-ng on Linux, say on macOS. */
	private async playTts(displayNo: number): Promise<void> {
		const text = `Sipariş ${displayNo} hazır`;
		const isLinux = process.platform === "linux";
		const cmd = isLinux ? "espeak-ng" : "say";
		const args = isLinux ? [text, "-v", "tr", "-s", "130"] : [text];

		await new Promise<void>((resolve) => {
			const proc = spawn(cmd, args, { stdio: "ignore" });

			const safetyTimeout = setTimeout(() => {
				proc.kill();
				resolve();
			}, this.delayMs + 5000);

			proc.on("close", () => {
				clearTimeout(safetyTimeout);
				resolve();
			});

			proc.on("error", () => {
				clearTimeout(safetyTimeout);
				// No audio command available at all — fall back to silent timer
				setTimeout(resolve, this.delayMs);
			});
		});
	}

	/** Manually trigger one poll cycle (for testing) */
	async processOne() {
		await this.poll();
	}
}
