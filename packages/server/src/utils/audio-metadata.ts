import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Extract duration from MP3 file using ffprobe.
 * Returns duration in seconds, or null if unable to determine.
 * Gracefully handles missing ffprobe or corrupted files.
 */
export async function getAudioDuration(filePath: string): Promise<number | null> {
	try {
		const { stdout } = await execFileAsync(
			"ffprobe",
			[
				"-v",
				"error",
				"-show_entries",
				"format=duration",
				"-of",
				"default=noprint_wrappers=1:nokey=1",
				filePath,
			],
			{ encoding: "utf-8" },
		);
		const duration = Number.parseFloat(stdout.trim());
		return Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null;
	} catch {
		// ffprobe not available, file corrupted, or other error
		return null;
	}
}
