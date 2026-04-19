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

describe("server settings contract (music + receipt)", () => {
	it("validates announcement_enabled accepts only 0 or 1", () => {
		expect(validateSettingValue(SETTING_KEYS.ANNOUNCEMENT_ENABLED, "0")).toBeNull();
		expect(validateSettingValue(SETTING_KEYS.ANNOUNCEMENT_ENABLED, "1")).toBeNull();
		expect(validateSettingValue(SETTING_KEYS.ANNOUNCEMENT_ENABLED, "true")).not.toBeNull();
		expect(validateSettingValue(SETTING_KEYS.ANNOUNCEMENT_ENABLED, "2")).not.toBeNull();
	});

	it("validates music_enabled accepts only 0 or 1", () => {
		expect(validateSettingValue(SETTING_KEYS.MUSIC_ENABLED, "0")).toBeNull();
		expect(validateSettingValue(SETTING_KEYS.MUSIC_ENABLED, "1")).toBeNull();
		expect(validateSettingValue(SETTING_KEYS.MUSIC_ENABLED, "true")).not.toBeNull();
		expect(validateSettingValue(SETTING_KEYS.MUSIC_ENABLED, "2")).not.toBeNull();
	});

	it("validates music_volume accepts 0-100 integers only", () => {
		expect(validateSettingValue(SETTING_KEYS.MUSIC_VOLUME, "0")).toBeNull();
		expect(validateSettingValue(SETTING_KEYS.MUSIC_VOLUME, "60")).toBeNull();
		expect(validateSettingValue(SETTING_KEYS.MUSIC_VOLUME, "100")).toBeNull();
		expect(validateSettingValue(SETTING_KEYS.MUSIC_VOLUME, "-1")).not.toBeNull();
		expect(validateSettingValue(SETTING_KEYS.MUSIC_VOLUME, "101")).not.toBeNull();
		expect(validateSettingValue(SETTING_KEYS.MUSIC_VOLUME, "50.5")).not.toBeNull();
	});

	it("validates announcement_delay_ms accepts 0-60000 integers", () => {
		expect(validateSettingValue("announcement_delay_ms", "0")).toBeNull();
		expect(validateSettingValue("announcement_delay_ms", "3000")).toBeNull();
		expect(validateSettingValue("announcement_delay_ms", "60000")).toBeNull();
		expect(validateSettingValue("announcement_delay_ms", "-1")).not.toBeNull();
		expect(validateSettingValue("announcement_delay_ms", "60001")).not.toBeNull();
		expect(validateSettingValue("announcement_delay_ms", "500.5")).not.toBeNull();
	});

	it("validates business_name and receipt_business_name reject empty and long strings", () => {
		expect(validateSettingValue("business_name", "Sepetarası")).toBeNull();
		expect(validateSettingValue("business_name", " ")).not.toBeNull();
		expect(validateSettingValue("business_name", "x".repeat(121))).not.toBeNull();
		expect(validateSettingValue("receipt_business_name", "OK")).toBeNull();
		expect(validateSettingValue("receipt_business_name", "x".repeat(121))).not.toBeNull();
	});

	it("validates receipt_address, phone, tax fields enforce length limits", () => {
		expect(validateSettingValue("receipt_address", "x".repeat(240))).toBeNull();
		expect(validateSettingValue("receipt_address", "x".repeat(241))).not.toBeNull();
		expect(validateSettingValue("receipt_phone", "x".repeat(32))).toBeNull();
		expect(validateSettingValue("receipt_phone", "x".repeat(33))).not.toBeNull();
		expect(validateSettingValue("receipt_tax_id", "x".repeat(64))).toBeNull();
		expect(validateSettingValue("receipt_tax_id", "x".repeat(65))).not.toBeNull();
		expect(validateSettingValue("receipt_tax_office", "x".repeat(64))).toBeNull();
		expect(validateSettingValue("receipt_tax_office", "x".repeat(65))).not.toBeNull();
	});

	it("returns error for unknown setting key", () => {
		expect(validateSettingValue("totally_unknown_key", "any")).not.toBeNull();
	});
});
