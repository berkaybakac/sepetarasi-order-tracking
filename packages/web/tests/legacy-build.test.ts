import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "acorn";
import { build, mergeConfig } from "vite";
import { describe, expect, it } from "vitest";
import viteConfig from "../vite.config";

const testsDir = dirname(fileURLToPath(import.meta.url));
const webDir = resolve(testsDir, "..");

describe.sequential("legacy build output", () => {
	it("emits legacy bundles that parse as ES5", async () => {
		const tempDistDir = mkdtempSync(join(tmpdir(), "sepetarasi-web-legacy-build-"));

		try {
			await build(
				mergeConfig(viteConfig, {
					configFile: false,
					logLevel: "silent",
					root: webDir,
					build: {
						emptyOutDir: true,
						outDir: tempDistDir,
					},
				}),
			);

			const distAssetsDir = resolve(tempDistDir, "assets");
			const legacyFiles = readdirSync(distAssetsDir).filter(
				(fileName) => fileName.endsWith(".js") && fileName.includes("-legacy"),
			);

			expect(legacyFiles.length).toBeGreaterThan(0);

			for (const fileName of legacyFiles) {
				const source = readFileSync(resolve(distAssetsDir, fileName), "utf8");
				expect(() => parse(source, { ecmaVersion: 5, sourceType: "script" })).not.toThrow();
			}
		} finally {
			rmSync(tempDistDir, { recursive: true, force: true });
		}
	}, 120_000);
});
