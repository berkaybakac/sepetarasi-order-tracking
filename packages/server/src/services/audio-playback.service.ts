import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

interface StructuredLogger {
	info: (obj: Record<string, unknown>, msg?: string) => void;
	warn: (obj: Record<string, unknown>, msg?: string) => void;
	error: (obj: Record<string, unknown>, msg?: string) => void;
}

function writeFallbackLog(
	level: "info" | "warn" | "error",
	msg: string,
	obj: Record<string, unknown>,
) {
	const line = JSON.stringify({
		timestamp: new Date().toISOString(),
		level,
		component: "audio-playback",
		msg,
		...obj,
	});
	const stream = level === "error" ? process.stderr : process.stdout;
	stream.write(`${line}\n`);
}

function createFallbackLogger(): StructuredLogger {
	const isTestEnv = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
	if (isTestEnv) {
		return {
			info: () => undefined,
			warn: () => undefined,
			error: () => undefined,
		};
	}

	return {
		info: (obj, msg = "audio-playback") => writeFallbackLog("info", msg, obj),
		warn: (obj, msg = "audio-playback") => writeFallbackLog("warn", msg, obj),
		error: (obj, msg = "audio-playback") => writeFallbackLog("error", msg, obj),
	};
}

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
	/** Structured logger (Fastify/Pino compatible). */
	logger?: StructuredLogger;
}

export class AudioPlaybackService {
	private disableAudio: boolean;
	private enableTtsFallback: boolean;
	private announcementsPath: string;
	private alsaDevice: string | undefined;
	private delayMs: number;
	private getVolume: () => number;
	private logger: StructuredLogger;

	constructor(opts: AudioPlaybackOptions = {}) {
		this.disableAudio = opts.disableAudio ?? false;
		this.enableTtsFallback = opts.enableTtsFallback ?? false;
		this.announcementsPath =
			opts.announcementsPath ??
			join(process.cwd(), "packages", "server", "assets", "announcements");
		this.alsaDevice = opts.alsaDevice;
		this.delayMs = opts.delayMs ?? 2500;
		this.getVolume = opts.getVolume ?? (() => 100);
		this.logger = opts.logger ?? createFallbackLogger();
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
			this.logger.info(
				{
					event: "audio.play.skipped",
					reason: "audio_disabled",
					displayNo,
					delayMs: this.delayMs,
				},
				"Audio playback skipped",
			);
			await new Promise<void>((resolve) => setTimeout(resolve, this.delayMs));
			return;
		}

		const volume = Math.max(0, Math.min(100, this.getVolume()));
		const audioFile = join(this.announcementsPath, `${displayNo}.mp3`);
		const hasAudioFile = existsSync(audioFile);
		this.logger.info(
			{
				event: "audio.play.start",
				displayNo,
				volume,
				alsaDevice: this.alsaDevice,
				audioFile,
				hasAudioFile,
			},
			"Audio playback started",
		);

		if (hasAudioFile) {
			const played = await this.playFile(audioFile, volume);
			if (played) return;
		}

		if (!this.enableTtsFallback) {
			const reason = hasAudioFile ? "player failed" : "file missing";
			this.logger.warn(
				{
					event: "audio.play.skipped",
					reason,
					displayNo,
					ttsFallbackEnabled: false,
					delayMs: this.delayMs,
				},
				"Announcement audio skipped",
			);
			await new Promise<void>((resolve) => setTimeout(resolve, this.delayMs));
			return;
		}

		if (!hasAudioFile) {
			this.logger.warn(
				{
					event: "audio.play.fallback_tts",
					reason: "file_missing",
					displayNo,
				},
				"No pre-recorded audio file; falling back to TTS",
			);
		} else {
			this.logger.warn(
				{
					event: "audio.play.fallback_tts",
					reason: "player_failed",
					displayNo,
				},
				"Audio player failed; falling back to TTS",
			);
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

		this.logger.info(
			{
				event: "audio.player.command_start",
				command: cmd,
				args,
				filePath,
			},
			"Starting audio player command",
		);

		return new Promise<boolean>((resolve) => {
			const proc = spawn(cmd, args, { stdio: "ignore" });

			const safetyTimeout = setTimeout(() => {
				proc.kill();
				resolve(false);
			}, this.delayMs + 5000);

			proc.on("close", (code) => {
				clearTimeout(safetyTimeout);
				if (code !== 0) {
					this.logger.warn(
						{
							event: "audio.player.command_exit_nonzero",
							command: cmd,
							code,
						},
						"Audio player exited with non-zero code",
					);
				}
				resolve(code === 0);
			});

			proc.on("error", (err) => {
				clearTimeout(safetyTimeout);
				this.logger.warn(
					{
						event: "audio.player.command_unavailable",
						command: cmd,
						error: err instanceof Error ? err.message : String(err),
					},
					"Audio player command unavailable",
				);
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
		this.logger.info(
			{
				event: "audio.tts.start",
				displayNo,
				command: cmd,
				args,
			},
			"Starting TTS fallback",
		);

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

			proc.on("error", (err) => {
				clearTimeout(safetyTimeout);
				this.logger.warn(
					{
						event: "audio.tts.command_unavailable",
						command: cmd,
						displayNo,
						error: err instanceof Error ? err.message : String(err),
						fallback: "silent_timer",
						delayMs: this.delayMs,
					},
					"TTS command unavailable; using silent timer fallback",
				);
				// No audio command available at all — fall back to silent timer
				setTimeout(resolve, this.delayMs);
			});
		});
	}
}
