import type { DisplayConfig, DisplayLayoutPreference, DisplayTextScale } from "@sepetarasi/shared";

export interface DisplayUrlOverridesInput {
	layout: DisplayLayoutPreference | "";
	max: string;
	scale: DisplayTextScale | "";
}

export function buildDisplayUrl(overrides: DisplayUrlOverridesInput): string {
	const params = new URLSearchParams();
	if (overrides.layout && overrides.layout !== "auto") params.set("layout", overrides.layout);
	const maxNum = Number(overrides.max);
	if (overrides.max !== "" && Number.isInteger(maxNum) && maxNum >= 1) {
		params.set("max", overrides.max);
	}
	if (overrides.scale !== "") params.set("scale", overrides.scale);
	const queryString = params.toString();
	return queryString ? `/display?${queryString}` : "/display";
}

/**
 * URL arama parametrelerinden per-screen display override'larını ayrıştırır.
 * Geçersiz değerler sessizce yok sayılır.
 *
 * Desteklenen parametreler:
 *   ?layout=stack|split → layoutPreference
 *   ?max=N       → maxVisiblePerColumn (tam sayı >= 1)
 *   ?scale=s|m|l → textScale
 */
export function parseUrlDisplayOverrides(
	search: string,
): Partial<Pick<DisplayConfig, "layoutPreference" | "maxVisiblePerColumn" | "textScale">> {
	const params = new URLSearchParams(search);
	const overrides: Partial<
		Pick<DisplayConfig, "layoutPreference" | "maxVisiblePerColumn" | "textScale">
	> = {};

	const layout = params.get("layout");
	if (layout === "stack" || layout === "split") {
		overrides.layoutPreference = layout;
	} else if (layout !== null && layout !== "auto" && layout !== "") {
		console.warn(`[display] Geçersiz URL param: layout="${layout}" (beklenen: stack|split)`);
	}

	const maxRaw = params.get("max");
	const max = Number(maxRaw);
	if (Number.isInteger(max) && max >= 1) {
		overrides.maxVisiblePerColumn = max;
	} else if (maxRaw !== null && maxRaw !== "") {
		console.warn(`[display] Geçersiz URL param: max="${maxRaw}" (beklenen: tam sayı >= 1)`);
	}

	const scale = params.get("scale");
	if (scale === "s" || scale === "m" || scale === "l") {
		overrides.textScale = scale;
	} else if (scale !== null && scale !== "") {
		console.warn(`[display] Geçersiz URL param: scale="${scale}" (beklenen: s|m|l)`);
	}

	return overrides;
}

export function resolveDisplayConfigWithUrlOverrides(
	baseConfig: DisplayConfig,
	search: string,
): DisplayConfig {
	return { ...baseConfig, ...parseUrlDisplayOverrides(search) };
}
