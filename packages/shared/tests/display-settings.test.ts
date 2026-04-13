import { describe, expect, it } from "vitest";
import {
	DEFAULT_DISPLAY_CONFIG,
	DEFAULT_DISPLAY_SETTINGS,
	DISPLAY_SETTING_KEYS,
	type DisplaySettingKey,
	SETTING_KEYS,
	areDisplayConfigsEqual,
	parseDisplaySettings,
	serializeDisplayConfig,
	validateDisplaySettingValue,
} from "../src/index.js";

describe("display-settings (happy path)", () => {
	it("parses valid values from settings map", () => {
		const config = parseDisplaySettings({
			[SETTING_KEYS.RESTAURANT_NAME]: "Sepetarasi Mutfak",
			[SETTING_KEYS.DISPLAY_PROFILE]: "tv_1080p",
			[SETTING_KEYS.DISPLAY_LAYOUT]: "split",
			[SETTING_KEYS.DISPLAY_MAX_VISIBLE]: "30",
			[SETTING_KEYS.DISPLAY_PAGE_SECONDS]: "10",
			[SETTING_KEYS.DISPLAY_READY_MINUTES]: "12",
			[SETTING_KEYS.DISPLAY_TEXT_SCALE]: "l",
			[SETTING_KEYS.DISPLAY_THEME]: "retro",
		});

		expect(config).toEqual({
			profile: "tv_1080p",
			layoutPreference: "split",
			maxVisiblePerColumn: 30,
			pageSeconds: 10,
			restaurantName: "Sepetarasi Mutfak",
			readyDisplayMinutes: 12,
			textScale: "l",
			theme: "retro",
		});
	});

	it("serializes config with the exact display setting keys", () => {
		const payload = serializeDisplayConfig(DEFAULT_DISPLAY_CONFIG);

		expect(payload).toEqual(DEFAULT_DISPLAY_SETTINGS);
		expect(Object.keys(payload).sort()).toEqual([...DISPLAY_SETTING_KEYS].sort());
	});

	it("checks config equality via shared serializer", () => {
		const current = { ...DEFAULT_DISPLAY_CONFIG, pageSeconds: 9 };
		const same = { ...DEFAULT_DISPLAY_CONFIG, pageSeconds: 9 };
		const changed = { ...DEFAULT_DISPLAY_CONFIG, pageSeconds: 10 };

		expect(areDisplayConfigsEqual(current, same)).toBe(true);
		expect(areDisplayConfigsEqual(current, changed)).toBe(false);
	});
});

describe("display-settings (sad path)", () => {
	it("falls back to defaults for invalid enum and number values", () => {
		const config = parseDisplaySettings({
			[SETTING_KEYS.DISPLAY_PROFILE]: "x",
			[SETTING_KEYS.DISPLAY_LAYOUT]: "y",
			[SETTING_KEYS.DISPLAY_MAX_VISIBLE]: "0",
			[SETTING_KEYS.DISPLAY_PAGE_SECONDS]: "-1",
			[SETTING_KEYS.DISPLAY_READY_MINUTES]: "abc",
			[SETTING_KEYS.DISPLAY_TEXT_SCALE]: "xl",
			[SETTING_KEYS.DISPLAY_THEME]: "neon",
		});

		expect(config).toEqual(DEFAULT_DISPLAY_CONFIG);
	});

	it("applies profile defaults and clamps ready minutes upper bound", () => {
		const config = parseDisplaySettings({
			[SETTING_KEYS.DISPLAY_PROFILE]: "led_256x512",
			[SETTING_KEYS.DISPLAY_READY_MINUTES]: "999",
		});

		expect(config.profile).toBe("led_256x512");
		expect(config.layoutPreference).toBe("stack");
		expect(config.maxVisiblePerColumn).toBe(4);
		expect(config.pageSeconds).toBe(6);
		expect(config.readyDisplayMinutes).toBe(60);
	});

	it("returns validation errors for invalid per-key values", () => {
		const invalidValues: Record<DisplaySettingKey, string> = {
			[SETTING_KEYS.RESTAURANT_NAME]: "x".repeat(61),
			[SETTING_KEYS.DISPLAY_PROFILE]: "unknown-profile",
			[SETTING_KEYS.DISPLAY_LAYOUT]: "invalid-layout",
			[SETTING_KEYS.DISPLAY_MAX_VISIBLE]: "0",
			[SETTING_KEYS.DISPLAY_PAGE_SECONDS]: "0",
			[SETTING_KEYS.DISPLAY_READY_MINUTES]: "61",
			[SETTING_KEYS.DISPLAY_TEXT_SCALE]: "xl",
			[SETTING_KEYS.DISPLAY_THEME]: "neon",
		};

		for (const key of DISPLAY_SETTING_KEYS) {
			expect(validateDisplaySettingValue(key, invalidValues[key])).not.toBeNull();
		}
	});
});

describe("display-settings (critical contract)", () => {
	it("keeps default settings contract internally consistent", () => {
		expect(Object.keys(DEFAULT_DISPLAY_SETTINGS).sort()).toEqual([...DISPLAY_SETTING_KEYS].sort());

		for (const key of DISPLAY_SETTING_KEYS) {
			expect(validateDisplaySettingValue(key, DEFAULT_DISPLAY_SETTINGS[key])).toBeNull();
		}
	});

	it("round-trips defaults without drift", () => {
		const parsed = parseDisplaySettings(DEFAULT_DISPLAY_SETTINGS);
		const serialized = serializeDisplayConfig(parsed);

		expect(parsed).toEqual(DEFAULT_DISPLAY_CONFIG);
		expect(serialized).toEqual(DEFAULT_DISPLAY_SETTINGS);
	});
});
