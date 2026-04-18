import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "acorn";
import { describe, expect, it } from "vitest";

const testsDir = dirname(fileURLToPath(import.meta.url));
const webDir = resolve(testsDir, "..");

describe.sequential("legacy build output", () => {
	it("emits legacy bundles that parse as ES5", () => {
		const tempDistDir = mkdtempSync(join(tmpdir(), "sepetarasi-web-legacy-build-"));

		try {
			execFileSync("npm", ["run", "build", "--", "--outDir", tempDistDir], {
				cwd: webDir,
				stdio: "pipe",
			});

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
	}, 60_000);
});
