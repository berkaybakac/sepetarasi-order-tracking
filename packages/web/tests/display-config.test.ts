import { describe, expect, it } from "vitest";
import {
	DEFAULT_DISPLAY_CONFIG,
	getPageCount,
	getPageSlice,
	parseDisplaySettings,
	resolveLayoutMode,
	resolveMaxVisiblePerColumn,
} from "../src/views/display/display-config";

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
