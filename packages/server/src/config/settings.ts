import { SETTING_KEYS } from "@sepetarasi/shared";

const EDITABLE_SETTING_KEYS = [
	SETTING_KEYS.AUDIO_VOLUME,
	SETTING_KEYS.DISPLAY_PROFILE,
	SETTING_KEYS.DISPLAY_LAYOUT,
	SETTING_KEYS.DISPLAY_MAX_VISIBLE,
	SETTING_KEYS.DISPLAY_PAGE_SECONDS,
	"announcement_delay_ms",
	"business_name",
	"receipt_business_name",
	"receipt_address",
	"receipt_phone",
	"receipt_tax_id",
	"receipt_tax_office",
] as const;

const DISPLAY_PROFILE_VALUES = new Set(["auto", "led_256x512", "tv_1080p"]);
const DISPLAY_LAYOUT_VALUES = new Set(["auto", "split", "stack"]);

const PUBLIC_SETTING_KEYS = new Set<string>([
	SETTING_KEYS.DISPLAY_PROFILE,
	SETTING_KEYS.DISPLAY_LAYOUT,
	SETTING_KEYS.DISPLAY_MAX_VISIBLE,
	SETTING_KEYS.DISPLAY_PAGE_SECONDS,
]);

const editableSettings = new Set<string>(EDITABLE_SETTING_KEYS);

export function isEditableSettingKey(key: string): boolean {
	return editableSettings.has(key);
}

export function isPublicSettingKey(key: string): boolean {
	return PUBLIC_SETTING_KEYS.has(key);
}

export function toPublicSettings(
	rows: Array<{ key: string; value: string }>,
): Record<string, string> {
	const settings: Record<string, string> = {};
	for (const row of rows) {
		if (isPublicSettingKey(row.key)) {
			settings[row.key] = row.value;
		}
	}
	return settings;
}

export function validateSettingValue(key: string, value: string): string | null {
	switch (key) {
		case SETTING_KEYS.AUDIO_VOLUME: {
			const num = Number(value);
			if (!Number.isInteger(num) || num < 0 || num > 100) {
				return "audio_volume must be an integer between 0 and 100";
			}
			return null;
		}
		case SETTING_KEYS.DISPLAY_PROFILE:
			if (!DISPLAY_PROFILE_VALUES.has(value)) {
				return "display_profile must be one of: auto, led_256x512, tv_1080p";
			}
			return null;
		case SETTING_KEYS.DISPLAY_LAYOUT:
			if (!DISPLAY_LAYOUT_VALUES.has(value)) {
				return "display_layout must be one of: auto, split, stack";
			}
			return null;
		case SETTING_KEYS.DISPLAY_MAX_VISIBLE: {
			const maxVisible = Number(value);
			if (!Number.isInteger(maxVisible) || maxVisible < 1) {
				return "display_max_visible must be an integer >= 1";
			}
			return null;
		}
		case SETTING_KEYS.DISPLAY_PAGE_SECONDS: {
			const pageSeconds = Number(value);
			if (!Number.isInteger(pageSeconds) || pageSeconds < 1) {
				return "display_page_seconds must be an integer >= 1";
			}
			return null;
		}
		case "announcement_delay_ms": {
			const delay = Number(value);
			if (!Number.isInteger(delay) || delay < 0 || delay > 60000) {
				return "announcement_delay_ms must be an integer between 0 and 60000";
			}
			return null;
		}
		case "business_name":
		case "receipt_business_name":
			if (value.trim().length === 0) {
				return `${key} cannot be empty`;
			}
			if (value.length > 120) {
				return `${key} must be <= 120 characters`;
			}
			return null;
		case "receipt_address":
			if (value.length > 240) {
				return "receipt_address must be <= 240 characters";
			}
			return null;
		case "receipt_phone":
			if (value.length > 32) {
				return "receipt_phone must be <= 32 characters";
			}
			return null;
		case "receipt_tax_id":
		case "receipt_tax_office":
			if (value.length > 64) {
				return `${key} must be <= 64 characters`;
			}
			return null;
		default:
			return "Unknown setting key";
	}
}
