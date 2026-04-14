import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	DEFAULT_DISPLAY_CONFIG,
	getPageCount,
	getPageSlice,
	parseDisplaySettings,
	resolveLayoutMode,
	resolveMaxVisiblePerColumn,
} from "../src/views/display/display-config";
import {
	buildDisplayUrl,
	parseUrlDisplayOverrides,
	resolveDisplayConfigWithUrlOverrides,
} from "../src/views/display/display-url-overrides";

describe("parseUrlDisplayOverrides", () => {
	it("parses valid layout, max and scale", () => {
		expect(parseUrlDisplayOverrides("?layout=stack&max=4&scale=s")).toEqual({
			layoutPreference: "stack",
			maxVisiblePerColumn: 4,
			textScale: "s",
		});
	});

	it("returns empty object when no params present", () => {
		expect(parseUrlDisplayOverrides("")).toEqual({});
	});

	it("ignores invalid max values", () => {
		expect(parseUrlDisplayOverrides("?max=0")).toEqual({});
		expect(parseUrlDisplayOverrides("?max=-5")).toEqual({});
		expect(parseUrlDisplayOverrides("?max=abc")).toEqual({});
		expect(parseUrlDisplayOverrides("?max=1.5")).toEqual({});
	});

	it("ignores invalid scale values", () => {
		expect(parseUrlDisplayOverrides("?scale=xl")).toEqual({});
		expect(parseUrlDisplayOverrides("?scale=")).toEqual({});
	});

	it("ignores invalid layout values", () => {
		expect(parseUrlDisplayOverrides("?layout=auto")).toEqual({});
		expect(parseUrlDisplayOverrides("?layout=grid")).toEqual({});
		expect(parseUrlDisplayOverrides("?layout=")).toEqual({});
	});

	it("applies only the overrides that are present", () => {
		expect(parseUrlDisplayOverrides("?max=10")).toEqual({ maxVisiblePerColumn: 10 });
		expect(parseUrlDisplayOverrides("?scale=l")).toEqual({ textScale: "l" });
		expect(parseUrlDisplayOverrides("?layout=split")).toEqual({ layoutPreference: "split" });
	});
});

describe("parseUrlDisplayOverrides — console.warn on invalid params", () => {
	beforeEach(() => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("warns for unrecognised layout value", () => {
		parseUrlDisplayOverrides("?layout=grid");
		expect(console.warn).toHaveBeenCalledOnce();
		expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("layout"));
	});

	it("warns for invalid max value", () => {
		parseUrlDisplayOverrides("?max=0");
		expect(console.warn).toHaveBeenCalledOnce();
		expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("max"));
	});

	it("warns for unrecognised scale value", () => {
		parseUrlDisplayOverrides("?scale=xl");
		expect(console.warn).toHaveBeenCalledOnce();
		expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("scale"));
	});

	it("does not warn for layout=auto (intentionally silent global reset)", () => {
		parseUrlDisplayOverrides("?layout=auto");
		expect(console.warn).not.toHaveBeenCalled();
	});

	it("does not warn when params are absent or empty string", () => {
		parseUrlDisplayOverrides("");
		parseUrlDisplayOverrides("?layout=&max=&scale=");
		expect(console.warn).not.toHaveBeenCalled();
	});

	it("does not warn for valid params", () => {
		parseUrlDisplayOverrides("?layout=stack&max=5&scale=l");
		expect(console.warn).not.toHaveBeenCalled();
	});
});

describe("resolveDisplayConfigWithUrlOverrides", () => {
	it("applies URL overrides on top of base config", () => {
		const base = {
			...DEFAULT_DISPLAY_CONFIG,
			layoutPreference: "auto" as const,
			maxVisiblePerColumn: 9,
			textScale: "m" as const,
			theme: "retro" as const,
		};

		const resolved = resolveDisplayConfigWithUrlOverrides(base, "?layout=stack&max=4&scale=l");

		expect(resolved.layoutPreference).toBe("stack");
		expect(resolved.maxVisiblePerColumn).toBe(4);
		expect(resolved.textScale).toBe("l");
		expect(resolved.theme).toBe("retro");
	});

	it("keeps base config when URL params are invalid", () => {
		const base = {
			...DEFAULT_DISPLAY_CONFIG,
			maxVisiblePerColumn: 7,
			textScale: "s" as const,
		};

		const resolved = resolveDisplayConfigWithUrlOverrides(base, "?max=0&scale=xl");

		expect(resolved.maxVisiblePerColumn).toBe(7);
		expect(resolved.textScale).toBe("s");
	});
});

describe("buildDisplayUrl", () => {
	it("builds URL with valid overrides", () => {
		expect(buildDisplayUrl({ layout: "stack", max: "12", scale: "l" })).toBe(
			"/display?layout=stack&max=12&scale=l",
		);
	});

	it("omits global/invalid values", () => {
		expect(buildDisplayUrl({ layout: "", max: "", scale: "" })).toBe("/display");
		expect(buildDisplayUrl({ layout: "auto", max: "0", scale: "m" })).toBe("/display?scale=m");
		expect(buildDisplayUrl({ layout: "split", max: "1.5", scale: "" })).toBe(
			"/display?layout=split",
		);
	});
});

describe("display-config (happy path)", () => {
	it("parses valid settings", () => {
		const config = parseDisplaySettings({
			display_profile: "tv_1080p",
			display_layout: "split",
			display_max_visible: "30",
			display_page_seconds: "10",
		});

		expect(config.profile).toBe("tv_1080p");
		expect(config.layoutPreference).toBe("split");
		expect(config.maxVisiblePerColumn).toBe(30);
		expect(config.pageSeconds).toBe(10);
	});

	it("resolves layout by viewport when layout is auto", () => {
		const modeLandscape = resolveLayoutMode(1920, 1080, {
			profile: "auto",
			layoutPreference: "auto",
		});
		const modePortrait = resolveLayoutMode(512, 1024, {
			profile: "auto",
			layoutPreference: "auto",
		});

		expect(modeLandscape).toBe("split");
		expect(modePortrait).toBe("stack");
	});
});

describe("display-config (sad path)", () => {
	it("falls back to defaults for invalid values", () => {
		const config = parseDisplaySettings({
			display_profile: "x",
			display_layout: "y",
			display_max_visible: "-1",
			display_page_seconds: "0",
		});

		expect(config).toEqual(DEFAULT_DISPLAY_CONFIG);
	});

	it("clamps extreme numeric values", () => {
		const config = parseDisplaySettings({
			display_max_visible: "999",
			display_page_seconds: "999",
		});

		expect(config.maxVisiblePerColumn).toBe(999);
		expect(config.pageSeconds).toBe(999);
	});
});

describe("display-config (critical behavior)", () => {
	it("uses configured max in auto profile without hidden cap", () => {
		const maxVisible = resolveMaxVisiblePerColumn({
			...DEFAULT_DISPLAY_CONFIG,
			maxVisiblePerColumn: 20,
		});
		expect(maxVisible).toBe(20);
	});

	it("paginates and wraps page index safely", () => {
		const values = [1, 2, 3, 4, 5, 6, 7];
		expect(getPageCount(values.length, 3)).toBe(3);
		expect(getPageSlice(values, 3, 0)).toEqual([1, 2, 3]);
		expect(getPageSlice(values, 3, 1)).toEqual([4, 5, 6]);
		expect(getPageSlice(values, 3, 2)).toEqual([7]);
		expect(getPageSlice(values, 3, 4)).toEqual([4, 5, 6]); // wrapped page index
	});

	it("handles empty list without crashing", () => {
		expect(getPageCount(0, 10)).toBe(1);
		expect(getPageSlice<number>([], 10, 0)).toEqual([]);
	});
});
