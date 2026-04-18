import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testsDir = dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(resolve(testsDir, "../index.html"), "utf8");

function getCssBlock(selector: string) {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = indexHtml.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`));
	return match?.[1] ?? "";
}

describe("app shell inline html", () => {
	it("keeps the app root visible behind the boot overlay", () => {
		const rootBlock = getCssBlock("#root");

		expect(rootBlock).toContain("min-height: 100vh;");
		expect(rootBlock).not.toMatch(/opacity\s*:/);
		expect(rootBlock).not.toMatch(/filter\s*:/);
		expect(rootBlock).not.toMatch(/transform\s*:/);
		expect(rootBlock).not.toMatch(/transition\s*:/);
	});

	it("uses a simple fade when the boot overlay exits", () => {
		const bootBlock = getCssBlock("#app-boot");
		const leavingBlock = getCssBlock('#app-boot[data-state="leaving"]');

		expect(bootBlock).toContain("transition: opacity 180ms ease;");
		expect(bootBlock).not.toMatch(/transform\s*:/);
		expect(leavingBlock).toContain("opacity: 0;");
		expect(leavingBlock).not.toMatch(/transform\s*:/);
	});
});
