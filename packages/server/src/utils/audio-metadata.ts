import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface AudioMetadata {
	durationSeconds: number | null;
	bitRateKbps: number | null;
	sampleRateHz: number | null;
	channels: number | null;
	codecName: string | null;
	formatName: string | null;
}

interface FfprobeFormat {
	duration?: string;
	bit_rate?: string;
	format_name?: string;
}

interface FfprobeStream {
	codec_type?: string;
	codec_name?: string;
	sample_rate?: string;
	channels?: number | string;
	bit_rate?: string;
}

function parsePositiveFloat(value: unknown): number | null {
	const parsed = Number.parseFloat(String(value ?? ""));
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parsePositiveInt(value: unknown): number | null {
	const parsed = Number.parseInt(String(value ?? ""), 10);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function getAudioMetadata(filePath: string): Promise<AudioMetadata | null> {
	try {
		const { stdout } = await execFileAsync(
			"ffprobe",
			[
				"-v",
				"error",
				"-show_entries",
				"format=duration,bit_rate,format_name:stream=codec_type,codec_name,sample_rate,channels,bit_rate",
				"-of",
				"json",
				filePath,
			],
			{ encoding: "utf-8" },
		);
		const parsed = JSON.parse(stdout) as { format?: FfprobeFormat; streams?: FfprobeStream[] };
		const audioStream = parsed.streams?.find((stream) => stream.codec_type === "audio") ?? null;
		const formatBitRate = parsePositiveFloat(parsed.format?.bit_rate);
		const streamBitRate = parsePositiveFloat(audioStream?.bit_rate);
		const bitRateBps = streamBitRate ?? formatBitRate;
		return {
			durationSeconds: (() => {
				const duration = parsePositiveFloat(parsed.format?.duration);
				return duration === null ? null : Math.round(duration);
			})(),
			bitRateKbps: bitRateBps === null ? null : Math.round(bitRateBps / 1000),
			sampleRateHz: parsePositiveInt(audioStream?.sample_rate),
			channels: parsePositiveInt(audioStream?.channels),
			codecName: audioStream?.codec_name?.trim() || null,
			formatName: parsed.format?.format_name?.trim() || null,
		};
	} catch {
		// ffprobe not available, file corrupted, or other error
		return null;
	}
}

export function getMusicQualityWarnings(metadata: AudioMetadata): string[] {
	const warnings: string[] = [];
	if (metadata.codecName && metadata.codecName.toLowerCase() !== "mp3") {
		warnings.push("unexpected_codec");
	}
	if (metadata.bitRateKbps !== null && metadata.bitRateKbps < 128) {
		warnings.push("low_bitrate");
	}
	if (metadata.sampleRateHz !== null && metadata.sampleRateHz < 44100) {
		warnings.push("low_sample_rate");
	}
	if (metadata.channels !== null && metadata.channels < 2) {
		warnings.push("mono_channel");
	}
	return warnings;
}
