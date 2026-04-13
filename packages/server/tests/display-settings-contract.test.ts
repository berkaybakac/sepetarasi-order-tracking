import {
	DEFAULT_DISPLAY_SETTINGS,
	DISPLAY_EDITABLE_SETTING_KEYS,
	DISPLAY_PUBLIC_SETTING_KEYS,
	DISPLAY_SETTING_KEYS,
	type DisplaySettingKey,
	SETTING_KEYS,
	validateDisplaySettingValue,
} from "@sepetarasi/shared";
import { describe, expect, it } from "vitest";
import {
	isEditableSettingKey,
	isPublicSettingKey,
	validateSettingValue,
} from "../src/config/settings.js";

describe("server settings contract (display)", () => {
	it("marks every display setting as public and editable", () => {
		for (const key of DISPLAY_PUBLIC_SETTING_KEYS) {
			expect(isPublicSettingKey(key)).toBe(true);
		}
		for (const key of DISPLAY_EDITABLE_SETTING_KEYS) {
			expect(isEditableSettingKey(key)).toBe(true);
		}
	});

	it("accepts all shared default display settings", () => {
		for (const key of DISPLAY_SETTING_KEYS) {
			expect(validateSettingValue(key, DEFAULT_DISPLAY_SETTINGS[key])).toBeNull();
		}
	});

	it("produces the same validation result as shared validator for display keys", () => {
		const cases: Array<{ key: DisplaySettingKey; valid: string; invalid: string }> = [
			{
				key: SETTING_KEYS.RESTAURANT_NAME,
				valid: "Sepetarasi Mutfak",
				invalid: "x".repeat(61),
			},
			{
				key: SETTING_KEYS.DISPLAY_PROFILE,
				valid: "tv_1080p",
				invalid: "unknown-profile",
			},
			{
				key: SETTING_KEYS.DISPLAY_LAYOUT,
				valid: "split",
				invalid: "invalid-layout",
			},
			{
				key: SETTING_KEYS.DISPLAY_MAX_VISIBLE,
				valid: "30",
				invalid: "0",
			},
			{
				key: SETTING_KEYS.DISPLAY_PAGE_SECONDS,
				valid: "8",
				invalid: "0",
			},
			{
				key: SETTING_KEYS.DISPLAY_READY_MINUTES,
				valid: "5",
				invalid: "61",
			},
			{
				key: SETTING_KEYS.DISPLAY_TEXT_SCALE,
				valid: "m",
				invalid: "xl",
			},
			{
				key: SETTING_KEYS.DISPLAY_THEME,
				valid: "dark",
				invalid: "neon",
			},
		];

		for (const { key, valid, invalid } of cases) {
			expect(validateSettingValue(key, valid)).toBe(validateDisplaySettingValue(key, valid));
			expect(validateSettingValue(key, invalid)).toBe(validateDisplaySettingValue(key, invalid));
		}
	});
});
