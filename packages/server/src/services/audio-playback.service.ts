import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface AudioPlaybackOptions {
	/** Disable audio playback (useful for tests) */
	disableAudio?: boolean;
	/**
	 * Directory containing pre-recorded MP3 files named {display_no}.mp3
	 * Falls back to TTS (espeak-ng/say) if file not found.
	 */
	announcementsPath?: string;
	/** How long to wait when audio is disabled or as a silent fallback (ms) */
	delayMs?: number;
}

export class AudioPlaybackService {
	private disableAudio: boolean;
	private announcementsPath: string;
	private delayMs: number;

	constructor(opts: AudioPlaybackOptions = {}) {
		this.disableAudio = opts.disableAudio ?? false;
		this.announcementsPath =
			opts.announcementsPath ??
			join(process.cwd(), "packages", "server", "assets", "announcements");
		this.delayMs = opts.delayMs ?? 2500;
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
	async play(displayNo: number): Promise<void> {
		if (this.disableAudio) {
			await new Promise<void>((resolve) => setTimeout(resolve, this.delayMs));
			return;
		}

		const audioFile = join(this.announcementsPath, `${displayNo}.mp3`);
		if (existsSync(audioFile)) {
			const played = await this.playFile(audioFile);
			if (played) return;
		}

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
}
