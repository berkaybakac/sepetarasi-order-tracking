export type AudioRuntimeSignal =
	| "buffer_underrun"
	| "decode_error"
	| "clipping"
	| "device_error"
	| "file_io_error";

const SIGNAL_PATTERNS: Array<[AudioRuntimeSignal, RegExp]> = [
	["buffer_underrun", /\b(?:xrun|underrun)\b/i],
	[
		"decode_error",
		/\b(?:decode error|decoding error|corrupt|crc error|bad frame|illegal|lost sync|out of sync|resync)\b/i,
	],
	["clipping", /\bclip(?:ping)?\b/i],
	[
		"device_error",
		/\b(?:audio open|open audio|open device|device busy|no such device|cannot set|failed to open|can't open audio|cannot find card|alsa lib.*(?:cannot|can't|failed|error|unknown|invalid|no such|busy))\b/i,
	],
	[
		"file_io_error",
		/\b(?:no such file|permission denied|cannot open file|can't open file|file not found)\b/i,
	],
];

export function detectAudioRuntimeSignals(output: string): AudioRuntimeSignal[] {
	const signals: AudioRuntimeSignal[] = [];
	for (const [signal, pattern] of SIGNAL_PATTERNS) {
		if (pattern.test(output)) {
			signals.push(signal);
		}
	}
	return signals;
}
