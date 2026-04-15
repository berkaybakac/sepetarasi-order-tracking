import { SETTING_KEYS } from "./constants.js";

/**
 * Parse app_settings record to extract note presets array.
 * Returns empty array if key missing or JSON invalid.
 */
export function parseNotePresets(settings: Record<string, string>): string[] {
	const raw = settings[SETTING_KEYS.NOTE_PRESETS];
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter((p) => typeof p === "string") : [];
	} catch {
		return [];
	}
}

/**
 * Serialize note presets array to app_settings record.
 */
export function serializeNotePresets(presets: string[]): Record<string, string> {
	return {
		[SETTING_KEYS.NOTE_PRESETS]: JSON.stringify(presets),
	};
}
