import {
	DELIVERY_TARGET_MAX,
	DELIVERY_TARGET_MIN,
	DISPLAY_EDITABLE_SETTING_KEYS,
	DISPLAY_PUBLIC_SETTING_KEYS,
	SETTING_KEYS,
	isDisplaySettingKey,
	validateDisplaySettingValue,
} from "@sepetarasi/shared";

const EDITABLE_SETTING_KEYS = [
	SETTING_KEYS.AUDIO_VOLUME,
	SETTING_KEYS.ANNOUNCEMENT_ENABLED,
	SETTING_KEYS.MUSIC_VOLUME,
	SETTING_KEYS.MUSIC_ENABLED,
	SETTING_KEYS.NOTE_PRESETS,
	SETTING_KEYS.DELIVERY_TARGET_MINUTES,
	...DISPLAY_EDITABLE_SETTING_KEYS,
	"announcement_delay_ms",
	"business_name",
	"receipt_business_name",
	"receipt_address",
	"receipt_phone",
	"receipt_tax_id",
	"receipt_tax_office",
] as const;

const PUBLIC_SETTING_KEYS = new Set<string>([
	...DISPLAY_PUBLIC_SETTING_KEYS,
	SETTING_KEYS.NOTE_PRESETS as string,
	SETTING_KEYS.DELIVERY_TARGET_MINUTES as string,
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
	if (isDisplaySettingKey(key)) {
		return validateDisplaySettingValue(key, value);
	}

	switch (key) {
		case SETTING_KEYS.AUDIO_VOLUME: {
			const num = Number(value);
			if (!Number.isInteger(num) || num < 0 || num > 100) {
				return "Anons sesi 0 ile 100 arasında olmalıdır.";
			}
			return null;
		}
		case SETTING_KEYS.ANNOUNCEMENT_ENABLED: {
			if (value !== "0" && value !== "1") {
				return "Anons ayarı geçersiz.";
			}
			return null;
		}
		case SETTING_KEYS.MUSIC_VOLUME: {
			const num = Number(value);
			if (!Number.isInteger(num) || num < 0 || num > 100) {
				return "Müzik sesi 0 ile 100 arasında olmalıdır.";
			}
			return null;
		}
		case SETTING_KEYS.DELIVERY_TARGET_MINUTES: {
			const num = Number(value);
			if (!Number.isInteger(num) || num < DELIVERY_TARGET_MIN || num > DELIVERY_TARGET_MAX) {
				return `Teslim hedefi ${DELIVERY_TARGET_MIN} ile ${DELIVERY_TARGET_MAX} dakika arasında olmalıdır.`;
			}
			return null;
		}
		case SETTING_KEYS.MUSIC_ENABLED: {
			if (value !== "0" && value !== "1") {
				return "Müzik ayarı geçersiz.";
			}
			return null;
		}
		case SETTING_KEYS.NOTE_PRESETS: {
			try {
				const parsed = JSON.parse(value);
				if (!Array.isArray(parsed)) {
					return "Hazır not listesi geçersiz.";
				}
				if (parsed.length > 20) {
					return "En fazla 20 hazır not kaydedebilirsiniz.";
				}
				for (const item of parsed) {
					if (typeof item !== "string") {
						return "Hazır not listesi geçersiz.";
					}
					if (item.length === 0 || item.length > 50) {
						return "Her hazır not 1 ile 50 karakter arasında olmalıdır.";
					}
				}
				return null;
			} catch {
				return "Hazır not listesi geçersiz.";
			}
		}
		case "announcement_delay_ms": {
			const delay = Number(value);
			if (!Number.isInteger(delay) || delay < 0 || delay > 60000) {
				return "Anons gecikmesi 0 ile 60000 arasında olmalıdır.";
			}
			return null;
		}
		case "business_name":
		case "receipt_business_name":
			if (value.trim().length === 0) {
				return "İşletme adı boş bırakılamaz.";
			}
			if (value.length > 120) {
				return "İşletme adı en fazla 120 karakter olabilir.";
			}
			return null;
		case "receipt_address":
			if (value.length > 240) {
				return "Adres en fazla 240 karakter olabilir.";
			}
			return null;
		case "receipt_phone":
			if (value.length > 32) {
				return "Telefon numarası en fazla 32 karakter olabilir.";
			}
			return null;
		case "receipt_tax_id":
		case "receipt_tax_office":
			if (value.length > 64) {
				return "Vergi bilgisi en fazla 64 karakter olabilir.";
			}
			return null;
		default:
			return "Bu ayar güncellenemiyor.";
	}
}
