import { SETTING_KEYS } from "@sepetarasi/shared";
import { describe, expect, it } from "vitest";
import { validateSettingValue } from "../src/config/settings.js";

describe("validateSettingValue — delivery_target_minutes", () => {
	it("accepts valid integers within range", () => {
		expect(validateSettingValue(SETTING_KEYS.DELIVERY_TARGET_MINUTES, "20")).toBeNull();
		expect(validateSettingValue(SETTING_KEYS.DELIVERY_TARGET_MINUTES, "1")).toBeNull();
		expect(validateSettingValue(SETTING_KEYS.DELIVERY_TARGET_MINUTES, "120")).toBeNull();
	});

	it("rejects zero / negative / out-of-range", () => {
		expect(validateSettingValue(SETTING_KEYS.DELIVERY_TARGET_MINUTES, "0")).not.toBeNull();
		expect(validateSettingValue(SETTING_KEYS.DELIVERY_TARGET_MINUTES, "-5")).not.toBeNull();
		expect(validateSettingValue(SETTING_KEYS.DELIVERY_TARGET_MINUTES, "121")).not.toBeNull();
		expect(validateSettingValue(SETTING_KEYS.DELIVERY_TARGET_MINUTES, "200")).not.toBeNull();
	});

	it("rejects non-integer values", () => {
		expect(validateSettingValue(SETTING_KEYS.DELIVERY_TARGET_MINUTES, "20.5")).not.toBeNull();
		expect(validateSettingValue(SETTING_KEYS.DELIVERY_TARGET_MINUTES, "abc")).not.toBeNull();
		expect(validateSettingValue(SETTING_KEYS.DELIVERY_TARGET_MINUTES, "")).not.toBeNull();
	});
});
