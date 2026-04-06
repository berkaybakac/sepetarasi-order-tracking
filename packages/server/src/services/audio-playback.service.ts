import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface AudioPlaybackOptions {
	/** Disable audio playback (useful for tests) */
	disableAudio?: boolean;
	/** Allow TTS fallback when MP3 is missing or cannot be played (default: false for MVP) */
	enableTtsFallback?: boolean;
	/**
	 * Directory containing pre-recorded MP3 files named {display_no}.mp3
	 * Falls back to TTS (espeak-ng/say) only when enableTtsFallback=true.
	 */
	announcementsPath?: string;
	/** How long to wait when audio is disabled or as a silent fallback (ms) */
	delayMs?: number;
	/** ALSA device for mpg123 on Linux (e.g. "hw:2,0"). Uses default device if not set. */
	alsaDevice?: string;
	/** Returns current volume 0-100. Called on each play. Defaults to 100. */
	getVolume?: () => number;
}

export class AudioPlaybackService {
	private disableAudio: boolean;
	private enableTtsFallback: boolean;
	private announcementsPath: string;
	private alsaDevice: string | undefined;
	private delayMs: number;
	private getVolume: () => number;

	constructor(opts: AudioPlaybackOptions = {}) {
		this.disableAudio = opts.disableAudio ?? false;
		this.enableTtsFallback = opts.enableTtsFallback ?? false;
		this.announcementsPath =
			opts.announcementsPath ??
			join(process.cwd(), "packages", "server", "assets", "announcements");
		this.alsaDevice = opts.alsaDevice;
		this.delayMs = opts.delayMs ?? 2500;
		this.getVolume = opts.getVolume ?? (() => 100);
	}

	/**
	 * Play announcement audio for the given order number.
	 *
	 * Priority:
	 * 1. Pre-recorded MP3 file: {announcementsPath}/{displayNo}.mp3  (best quality)
	 *    - Linux: mpg123   macOS: afplay
	 * 2. TTS fallback (optional): espeak-ng (Linux) / say (macOS)
	 * 3. Silent timer fallback: if no audio command available
	 */
	async play(displayNo: number): Promise<void> {
		if (this.disableAudio) {
			await new Promise<void>((resolve) => setTimeout(resolve, this.delayMs));
			return;
		}

		const volume = Math.max(0, Math.min(100, this.getVolume()));
		console.log(
			`[audio] play: order=${displayNo}, alsaDevice=${JSON.stringify(this.alsaDevice)}, volume=${volume}`,
		);
		const audioFile = join(this.announcementsPath, `${displayNo}.mp3`);
		const hasAudioFile = existsSync(audioFile);
		if (hasAudioFile) {
			const played = await this.playFile(audioFile, volume);
			if (played) return;
		}

		if (!this.enableTtsFallback) {
			const reason = hasAudioFile ? "player failed" : "file missing";
			console.warn(
				`WARNING: Announcement audio skipped for order ${displayNo} (${reason}; TTS fallback disabled)`,
			);
			await new Promise<void>((resolve) => setTimeout(resolve, this.delayMs));
			return;
		}

		if (!hasAudioFile) {
			console.warn(`WARNING: No audio file for order ${displayNo} — falling back to TTS`);
		}
		await this.playTts(displayNo);
	}

	/** Play a pre-recorded MP3 file. Returns true if successful, false if command unavailable. */
	private async playFile(filePath: string, volume: number): Promise<boolean> {
		const isLinux = process.platform === "linux";
		const cmd = isLinux ? "mpg123" : "afplay";
		// mpg123: -f scale where 32768 = 100%
		// afplay: -v level where 1.0 = 100%
		const linuxArgs = ["-q", "-f", String(Math.round((volume / 100) * 32768))];
		if (this.alsaDevice) linuxArgs.push("-a", this.alsaDevice);
		linuxArgs.push(filePath);
		const args = isLinux ? linuxArgs : ["-v", (volume / 100).toFixed(2), filePath];

		console.log(`[audio] ${cmd} ${args.join(" ")}`);

		return new Promise<boolean>((resolve) => {
			const proc = spawn(cmd, args, { stdio: "ignore" });

			const safetyTimeout = setTimeout(() => {
				proc.kill();
				resolve(true);
			}, this.delayMs + 5000);

			proc.on("close", (code) => {
				clearTimeout(safetyTimeout);
				if (code !== 0) console.warn(`[audio] ${cmd} exited with code ${code}`);
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
}
