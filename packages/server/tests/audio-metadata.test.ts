import { describe, expect, it } from "vitest";
import { getMusicQualityWarnings } from "../src/utils/audio-metadata.js";

describe("getMusicQualityWarnings", () => {
	it("flags suspicious music-track quality characteristics", () => {
		expect(
			getMusicQualityWarnings({
				durationSeconds: 180,
				bitRateKbps: 96,
				sampleRateHz: 32000,
				channels: 1,
				codecName: "aac",
				formatName: "mp4",
			}),
		).toEqual(["unexpected_codec", "low_bitrate", "low_sample_rate", "mono_channel"]);
	});

	it("does not flag a typical stereo mp3 upload", () => {
		expect(
			getMusicQualityWarnings({
				durationSeconds: 200,
				bitRateKbps: 192,
				sampleRateHz: 44100,
				channels: 2,
				codecName: "mp3",
				formatName: "mp3",
			}),
		).toEqual([]);
	});
});
