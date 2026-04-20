import { describe, expect, it } from "vitest";
import {
	TB1_COMPAT_PROFILE_PRESETS,
	buildTb1CompatDisplayHtml,
	normalizeTb1CompatProfile,
} from "../src/display/tb1-compat.js";

describe("TB1 compatibility presets", () => {
	it("normalizes direct TB1 profiles", () => {
		expect(normalizeTb1CompatProfile("led_256x512")).toBe("led_256x512");
		expect(normalizeTb1CompatProfile("led_344_square")).toBe("led_344_square");
		expect(normalizeTb1CompatProfile("led_512_square")).toBe("led_512_square");
	});

	it("maps legacy display profiles to TB1-safe presets", () => {
		expect(normalizeTb1CompatProfile("portrait_compact")).toBe("led_256x512");
		expect(normalizeTb1CompatProfile("tiny_landscape")).toBe("led_512_square");
		expect(normalizeTb1CompatProfile("tv_1080p")).toBe("led_512_square");
		expect(normalizeTb1CompatProfile("auto")).toBeNull();
		expect(normalizeTb1CompatProfile("unknown")).toBeNull();
	});

	it("defines deterministic field presets for the three TB1 routes", () => {
		expect(TB1_COMPAT_PROFILE_PRESETS.led_256x512).toEqual({
			layoutPreference: "stack",
			maxVisiblePerColumn: 4,
			pageSeconds: 6,
			textScale: "s",
			listColumns: 2,
		});
		expect(TB1_COMPAT_PROFILE_PRESETS.led_344_square).toEqual({
			layoutPreference: "stack",
			maxVisiblePerColumn: 4,
			pageSeconds: 5,
			textScale: "s",
			listColumns: 2,
		});
		expect(TB1_COMPAT_PROFILE_PRESETS.led_512_square).toEqual({
			layoutPreference: "stack",
			maxVisiblePerColumn: 4,
			pageSeconds: 6,
			textScale: "m",
			listColumns: 2,
		});
	});

	it("emits testable forced-profile markers into the HTML shell", () => {
		const html = buildTb1CompatDisplayHtml("led_344_square");

		expect(html).toContain('data-tb1-forced-profile="led_344_square"');
		expect(html).toContain('var FORCED_PROFILE = "led_344_square"');
		expect(html).toContain("var READY_HIGHLIGHT_MS = 4000;");
		expect(html).toContain("var READY_HIGHLIGHT_QUEUE_LIMIT = 5;");
		expect(html).toContain("var PAGER_DOT_LIMIT = 5;");
		expect(html).toContain("var PROFILE_PRESETS = ");
		expect(html).toContain("var LEGACY_PROFILE_ALIASES = ");
		expect(html).toContain(".panel.ready .item.highlighted");
		expect(html).toContain(".panel-meta");
		expect(html).toContain(".pager-text");
		expect(html).toContain('id="prep-pager"');
		expect(html).toContain('id="ready-pager"');
		expect(html).toContain("function renderPagers(preparingPageCount, readyPageCount)");
		expect(html).toContain("function enqueueReadyHighlights(candidates, readyOrders)");
		expect(html).toContain("function startNextReadyHighlight(readyOrders)");
		expect(html).toContain("captureReadyHighlight(getReadyOrders());");
		expect(html).toContain("grid-template-columns: repeat(var(--list-columns), minmax(0, 1fr));");
		expect(html).not.toContain("grid-template-columns: repeat(1, minmax(0, 1fr));");
	});
});
