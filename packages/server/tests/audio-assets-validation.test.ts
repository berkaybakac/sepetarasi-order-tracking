import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(process.cwd(), "..", "..", "scripts", "validate-audio.sh");

function runValidator(audioDir: string) {
	// Keep PATH minimal so ffprobe is not detected in test environment.
	// This allows deterministic structural checks without real audio encoding.
	const res = spawnSync("bash", [scriptPath, audioDir], {
		env: {
			...process.env,
			PATH: "/usr/bin:/bin",
		},
		encoding: "utf-8",
	});

	return {
		status: res.status ?? 1,
		stdout: res.stdout ?? "",
		stderr: res.stderr ?? "",
	};
}

function writeRange(dir: string, start: number, end: number) {
	for (let n = start; n <= end; n++) {
		writeFileSync(join(dir, `${n}.mp3`), "dummy");
	}
}

const tempDirs: string[] = [];

function makeDir() {
	const dir = mkdtempSync(join(tmpdir(), "sepetarasi-audio-validate-"));
	tempDirs.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of tempDirs.splice(0, tempDirs.length)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("validate-audio.sh", () => {
	it("passes when files are exactly 1..400", () => {
		const dir = makeDir();
		writeRange(dir, 1, 400);

		const res = runValidator(dir);
		expect(res.status).toBe(0);
		expect(res.stdout).toContain("OK: Ses dosyaları 1..400 eksiksiz ve tutarlı.");
	});

	it("fails when files are missing in range", () => {
		const dir = makeDir();
		writeRange(dir, 1, 399);

		const res = runValidator(dir);
		expect(res.status).toBe(1);
		expect(res.stdout).toContain("HATA: Eksik dosya sayısı: 1");
		expect(res.stdout).toContain("400.mp3");
	});

	it("fails when out-of-range file exists", () => {
		const dir = makeDir();
		writeRange(dir, 1, 400);
		writeFileSync(join(dir, "401.mp3"), "dummy");

		const res = runValidator(dir);
		expect(res.status).toBe(1);
		expect(res.stdout).toContain("HATA: Aralık dışı/geçersiz isimli dosya sayısı: 1");
		expect(res.stdout).toContain("401.mp3");
	});

	it("fails when non-numeric file exists", () => {
		const dir = makeDir();
		writeRange(dir, 1, 400);
		writeFileSync(join(dir, "foo.mp3"), "dummy");

		const res = runValidator(dir);
		expect(res.status).toBe(1);
		expect(res.stdout).toContain("HATA: Aralık dışı/geçersiz isimli dosya sayısı: 1");
		expect(res.stdout).toContain("foo.mp3");
	});
});
