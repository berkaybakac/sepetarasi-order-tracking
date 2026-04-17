import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "acorn";
import { describe, expect, it } from "vitest";

const testsDir = dirname(fileURLToPath(import.meta.url));
const webDir = resolve(testsDir, "..");
const distAssetsDir = resolve(webDir, "dist/assets");

describe.sequential("legacy build output", () => {
	it("emits legacy bundles that parse as ES5", () => {
		execFileSync("npm", ["run", "build"], {
			cwd: webDir,
			stdio: "pipe",
		});

		const legacyFiles = readdirSync(distAssetsDir).filter(
			(fileName) => fileName.endsWith(".js") && fileName.includes("-legacy"),
		);

		expect(legacyFiles.length).toBeGreaterThan(0);

		for (const fileName of legacyFiles) {
			const source = readFileSync(resolve(distAssetsDir, fileName), "utf8");
			expect(() => parse(source, { ecmaVersion: 5, sourceType: "script" })).not.toThrow();
		}
	}, 60_000);
});
