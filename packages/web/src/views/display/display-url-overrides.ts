import {
	DISPLAY_PROFILES,
	type DisplayConfig,
	type DisplayLayoutPreference,
	type DisplayProfile,
	type DisplayTextScale,
} from "@sepetarasi/shared";
import { getDisplayProfileConfigPreset } from "./display-config";

export interface DisplayUrlOverridesInput {
	profile: DisplayProfile | "";
	layout: DisplayLayoutPreference | "";
	max: string;
	scale: DisplayTextScale | "";
}

const DISPLAY_PROFILE_SET = new Set<DisplayProfile>(DISPLAY_PROFILES);

function decodeQueryValue(value: string) {
	try {
		return decodeURIComponent(value.replace(/\+/g, " "));
	} catch {
		return value;
	}
}

function encodeQueryValue(value: string) {
	return encodeURIComponent(value);
}

function getQueryParam(search: string, key: string) {
	const query = search.startsWith("?") ? search.slice(1) : search;
	if (query.length === 0) return null;

	const pairs = query.split("&");
	for (const pair of pairs) {
		if (pair.length === 0) continue;
		const separatorIndex = pair.indexOf("=");
		const rawKey = separatorIndex >= 0 ? pair.slice(0, separatorIndex) : pair;
		if (decodeQueryValue(rawKey) !== key) continue;
		const rawValue = separatorIndex >= 0 ? pair.slice(separatorIndex + 1) : "";
		return decodeQueryValue(rawValue);
	}

	return null;
}

// Admin-side URL builder UI was removed for simplicity. Runtime URL override support stays
// intentionally so existing display links keep working and the feature can be reintroduced
// later without rebuilding the parsing/apply path from scratch.
export function buildDisplayUrl(overrides: DisplayUrlOverridesInput): string {
	const params: string[] = [];
	if (overrides.profile && overrides.profile !== "auto") {
		params.push(`profile=${encodeQueryValue(overrides.profile)}`);
	}
	if (overrides.layout && overrides.layout !== "auto") {
		params.push(`layout=${encodeQueryValue(overrides.layout)}`);
	}
	const maxNum = Number(overrides.max);
	if (overrides.max !== "" && Number.isInteger(maxNum) && maxNum >= 1) {
		params.push(`max=${encodeQueryValue(overrides.max)}`);
	}
	if (overrides.scale !== "") params.push(`scale=${encodeQueryValue(overrides.scale)}`);
	const queryString = params.join("&");
	return queryString ? `/display?${queryString}` : "/display";
}

/**
 * URL arama parametrelerinden per-screen display override'larını ayrıştırır.
 * Geçersiz değerler sessizce yok sayılır.
 *
 * Desteklenen parametreler:
 *   ?profile=name  → profile preset
 *   ?layout=stack|split → layoutPreference
 *   ?max=N       → maxVisiblePerColumn (tam sayı >= 1)
 *   ?scale=xs|s|m|l → textScale
 */
export function parseUrlDisplayOverrides(
	search: string,
): Partial<
	Pick<DisplayConfig, "profile" | "layoutPreference" | "maxVisiblePerColumn" | "textScale">
> {
	const overrides: Partial<
		Pick<DisplayConfig, "profile" | "layoutPreference" | "maxVisiblePerColumn" | "textScale">
	> = {};

	const profile = getQueryParam(search, "profile");
	if (profile && DISPLAY_PROFILE_SET.has(profile as DisplayProfile)) {
		overrides.profile = profile as DisplayProfile;
	} else if (profile !== null && profile !== "") {
		console.warn(
			`[display] Geçersiz URL param: profile="${profile}" (beklenen: ${DISPLAY_PROFILES.join("|")})`,
		);
	}

	const layout = getQueryParam(search, "layout");
	if (layout === "stack" || layout === "split") {
		overrides.layoutPreference = layout;
	} else if (layout !== null && layout !== "auto" && layout !== "") {
		console.warn(`[display] Geçersiz URL param: layout="${layout}" (beklenen: stack|split)`);
	}

	const maxRaw = getQueryParam(search, "max");
	const max = Number(maxRaw);
	if (Number.isInteger(max) && max >= 1) {
		overrides.maxVisiblePerColumn = max;
	} else if (maxRaw !== null && maxRaw !== "") {
		console.warn(`[display] Geçersiz URL param: max="${maxRaw}" (beklenen: tam sayı >= 1)`);
	}

	const scale = getQueryParam(search, "scale");
	if (scale === "xs" || scale === "s" || scale === "m" || scale === "l") {
		overrides.textScale = scale;
	} else if (scale !== null && scale !== "") {
		console.warn(`[display] Geçersiz URL param: scale="${scale}" (beklenen: xs|s|m|l)`);
	}

	return overrides;
}

export function resolveDisplayConfigWithUrlOverrides(
	baseConfig: DisplayConfig,
	search: string,
): DisplayConfig {
	const overrides = parseUrlDisplayOverrides(search);
	const profilePreset = overrides.profile
		? getDisplayProfileConfigPreset(overrides.profile)
		: undefined;

	return {
		...baseConfig,
		...profilePreset,
		...overrides,
	};
}
