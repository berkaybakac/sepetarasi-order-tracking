import {
	DISPLAY_EDITABLE_SETTING_KEYS,
	DISPLAY_PUBLIC_SETTING_KEYS,
	SETTING_KEYS,
	isDisplaySettingKey,
	validateDisplaySettingValue,
} from "@sepetarasi/shared";

const EDITABLE_SETTING_KEYS = [
	SETTING_KEYS.AUDIO_VOLUME,
	...DISPLAY_EDITABLE_SETTING_KEYS,
	"announcement_delay_ms",
	"business_name",
	"receipt_business_name",
	"receipt_address",
	"receipt_phone",
	"receipt_tax_id",
	"receipt_tax_office",
] as const;

const PUBLIC_SETTING_KEYS = new Set<string>(DISPLAY_PUBLIC_SETTING_KEYS);

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
	if (isDisplaySettingKey(key)) {
		return validateDisplaySettingValue(key, value);
	}

	switch (key) {
		case SETTING_KEYS.AUDIO_VOLUME: {
			const num = Number(value);
			if (!Number.isInteger(num) || num < 0 || num > 100) {
				return "audio_volume must be an integer between 0 and 100";
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
