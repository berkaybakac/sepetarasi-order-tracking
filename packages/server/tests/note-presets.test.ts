import { API_ROUTES, SETTING_KEYS } from "@sepetarasi/shared";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { validateSettingValue } from "../src/config/settings.js";
import type { AppDatabase } from "../src/db/connection.js";
import { createTestDb } from "../src/db/test-utils.js";
import { loginAsAdmin } from "./auth-helpers.js";

let db: AppDatabase;
let app: FastifyInstance;
let adminCookie: string;

beforeEach(async () => {
	db = createTestDb();
	app = await buildApp({ db, disableWorker: true, disableStatic: true });
	adminCookie = await loginAsAdmin(app);
});

afterEach(async () => {
	await app.close();
});

describe("note_presets validation", () => {
	it("accepts an empty JSON array", () => {
		expect(validateSettingValue(SETTING_KEYS.NOTE_PRESETS, "[]")).toBeNull();
	});

	it("accepts a valid array of short strings", () => {
		const value = JSON.stringify(["Ketçap bol", "Acılı", "Soğansız"]);
		expect(validateSettingValue(SETTING_KEYS.NOTE_PRESETS, value)).toBeNull();
	});

	it("rejects invalid JSON", () => {
		expect(validateSettingValue(SETTING_KEYS.NOTE_PRESETS, "not-json")).toMatch(
			/Hazır not listesi geçersiz/,
		);
	});

	it("rejects non-array JSON", () => {
		expect(validateSettingValue(SETTING_KEYS.NOTE_PRESETS, '{"a":"b"}')).toMatch(
			/Hazır not listesi geçersiz/,
		);
	});

	it("rejects more than 20 items", () => {
		const value = JSON.stringify(Array.from({ length: 21 }, (_, i) => `n${i}`));
		expect(validateSettingValue(SETTING_KEYS.NOTE_PRESETS, value)).toMatch(/En fazla 20/);
	});

	it("rejects non-string items", () => {
		expect(validateSettingValue(SETTING_KEYS.NOTE_PRESETS, '["ok",1]')).toMatch(
			/Hazır not listesi geçersiz/,
		);
	});

	it("rejects empty string item", () => {
		expect(validateSettingValue(SETTING_KEYS.NOTE_PRESETS, '["ok",""]')).toMatch(/1 ile 50/);
	});

	it("rejects item longer than 50 chars", () => {
		const tooLong = "x".repeat(51);
		expect(validateSettingValue(SETTING_KEYS.NOTE_PRESETS, JSON.stringify([tooLong]))).toMatch(
			/1 ile 50/,
		);
	});
});

describe("note_presets via HTTP", () => {
	it("appears in /settings/public response (anonymous access)", async () => {
		const presets = ["Ketçap bol", "Acılı"];
		const patchRes = await app.inject({
			method: "PATCH",
			url: API_ROUTES.V1.SETTINGS_BULK,
			headers: { cookie: adminCookie },
			payload: { settings: { [SETTING_KEYS.NOTE_PRESETS]: JSON.stringify(presets) } },
		});
		expect(patchRes.statusCode).toBe(200);

		const publicRes = await app.inject({
			method: "GET",
			url: API_ROUTES.V1.SETTINGS_PUBLIC,
		});
		expect(publicRes.statusCode).toBe(200);

		const data = publicRes.json().data as Record<string, string>;
		expect(data[SETTING_KEYS.NOTE_PRESETS]).toBe(JSON.stringify(presets));
	});

	it("rejects invalid presets through bulk endpoint", async () => {
		const res = await app.inject({
			method: "PATCH",
			url: API_ROUTES.V1.SETTINGS_BULK,
			headers: { cookie: adminCookie },
			payload: { settings: { [SETTING_KEYS.NOTE_PRESETS]: "not-json" } },
		});
		expect(res.statusCode).toBe(400);
		expect(res.json().error.code).toBe("INVALID_SETTING_VALUE");
	});

	it("kasa cashier can read presets via public endpoint without admin auth", async () => {
		await app.inject({
			method: "PATCH",
			url: API_ROUTES.V1.SETTINGS_BULK,
			headers: { cookie: adminCookie },
			payload: { settings: { [SETTING_KEYS.NOTE_PRESETS]: '["Sıcak"]' } },
		});

		// Anonymous (kasa kullanıcısı için en sıkı senaryo): yine de erişebilmeli
		const res = await app.inject({
			method: "GET",
			url: API_ROUTES.V1.SETTINGS_PUBLIC,
		});
		expect(res.statusCode).toBe(200);
		const data = res.json().data as Record<string, string>;
		expect(JSON.parse(data[SETTING_KEYS.NOTE_PRESETS] ?? "[]")).toEqual(["Sıcak"]);
	});
});
