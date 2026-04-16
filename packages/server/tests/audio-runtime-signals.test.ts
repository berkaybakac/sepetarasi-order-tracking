import { describe, expect, it } from "vitest";
import { detectAudioRuntimeSignals } from "../src/utils/audio-runtime-signals.js";

describe("detectAudioRuntimeSignals", () => {
	it("detects likely playback-quality related stderr signals", () => {
		expect(
			detectAudioRuntimeSignals(
				"ALSA lib pcm.c:2666 cannot open audio device after xrun recovery failed with decode error and clipping",
			),
		).toEqual(["buffer_underrun", "decode_error", "clipping", "device_error"]);
	});

	it("detects file and device failures separately", () => {
		expect(
			detectAudioRuntimeSignals("cannot open file: No such file and failed to open audio device"),
		).toEqual(["device_error", "file_io_error"]);
	});

	it("returns no signals for benign output", () => {
		expect(detectAudioRuntimeSignals("MPEG 1.0 L III, 128 kbps, joint-stereo")).toEqual([]);
	});

	it("does not treat a plain ALSA mention as a device error", () => {
		expect(detectAudioRuntimeSignals("ALSA backend selected for playback")).toEqual([]);
	});
});
