import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SETTING_KEYS } from "@sepetarasi/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { AppDatabase } from "../src/db/connection.js";
import { appSettings, musicTracks } from "../src/db/schema.js";
import { createTestDb } from "../src/db/test-utils.js";
import { loginAsAdmin } from "./auth-helpers.js";

function buildMultipartPayload(fileName: string, mimeType: string, fileBuffer: Buffer) {
	const boundary = `----sepetarasi-${Math.random().toString(16).slice(2)}`;
	const header = Buffer.from(
		`--${boundary}\r\n` +
			`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
			`Content-Type: ${mimeType}\r\n\r\n`,
	);
	const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
	const payload = Buffer.concat([header, fileBuffer, footer]);
	return { boundary, payload };
}

let db: AppDatabase;
let app: FastifyInstance;
let adminCookie: string;
let musicDir: string;

beforeEach(async () => {
	db = createTestDb();
	musicDir = mkdtempSync(join(tmpdir(), "sepetarasi-music-test-"));
	app = await buildApp({
		db,
		disableWorker: true,
		disableStatic: true,
		musicPath: musicDir,
	});
	adminCookie = await loginAsAdmin(app);
});

afterEach(async () => {
	await app.close();
	rmSync(musicDir, { recursive: true, force: true });
});

describe("Music routes", () => {
	it("uploads a 2MB MP3 fully and does not leak file_path in API response", async () => {
		const fileBuffer = Buffer.alloc(2 * 1024 * 1024, 0x1);
		const { boundary, payload } = buildMultipartPayload("mix-2mb.mp3", "audio/mpeg", fileBuffer);

		const res = await app.inject({
			method: "POST",
			url: "/api/v1/music/tracks",
			headers: {
				cookie: adminCookie,
				"content-type": `multipart/form-data; boundary=${boundary}`,
			},
			payload,
		});

		expect(res.statusCode).toBe(201);
		const body = res.json();
		expect(body.ok).toBe(true);
		expect(body.data.file_size).toBe(fileBuffer.length);
		expect(body.data.file_path).toBeUndefined();

		const row = db.select().from(musicTracks).where(eq(musicTracks.id, body.data.id)).get();
		expect(row).toBeDefined();
		expect(row?.file_size).toBe(fileBuffer.length);
		expect(row?.file_path).toBeTruthy();
		expect(existsSync(row!.file_path)).toBe(true);

		const listRes = await app.inject({
			method: "GET",
			url: "/api/v1/music/tracks",
			headers: { cookie: adminCookie },
		});
		expect(listRes.statusCode).toBe(200);
		const tracksBody = listRes.json();
		expect(tracksBody.data[0].file_path).toBeUndefined();
	});

	it("returns 413 and does not persist track when upload exceeds configured max size", async () => {
		const localDb = createTestDb();
		const localMusicDir = mkdtempSync(join(tmpdir(), "sepetarasi-music-limit-test-"));
		const localApp = await buildApp({
			db: localDb,
			disableWorker: true,
			disableStatic: true,
			musicPath: localMusicDir,
			musicUploadMaxBytes: 32 * 1024, // test override (32 KB)
		});

		try {
			const localAdminCookie = await loginAsAdmin(localApp);
			const fileBuffer = Buffer.alloc(64 * 1024, 0x2); // 64 KB
			const { boundary, payload } = buildMultipartPayload(
				"too-large.mp3",
				"audio/mpeg",
				fileBuffer,
			);

			const res = await localApp.inject({
				method: "POST",
				url: "/api/v1/music/tracks",
				headers: {
					cookie: localAdminCookie,
					"content-type": `multipart/form-data; boundary=${boundary}`,
				},
				payload,
			});

			expect(res.statusCode).toBe(413);
			expect(res.json().error.code).toBe("FILE_TOO_LARGE");
			expect(localDb.select().from(musicTracks).all()).toHaveLength(0);
		} finally {
			await localApp.close();
			rmSync(localMusicDir, { recursive: true, force: true });
		}
	});

	it("does not expose removed download endpoints", async () => {
		const postRes = await app.inject({
			method: "POST",
			url: "/api/v1/music/download",
			headers: { cookie: adminCookie },
			payload: { trackIds: ["x"] },
		});
		expect(postRes.statusCode).toBe(404);

		const getRes = await app.inject({
			method: "GET",
			url: "/api/v1/music/download?token=abc",
			headers: { cookie: adminCookie },
		});
		expect(getRes.statusCode).toBe(404);
	});

	it("rejects upload with wrong MIME type and does not persist track", async () => {
		const fileBuffer = Buffer.alloc(1024, 0x3);
		const { boundary, payload } = buildMultipartPayload(
			"not-audio.wav",
			"audio/wav",
			fileBuffer,
		);

		const res = await app.inject({
			method: "POST",
			url: "/api/v1/music/tracks",
			headers: {
				cookie: adminCookie,
				"content-type": `multipart/form-data; boundary=${boundary}`,
			},
			payload,
		});

		expect(res.statusCode).toBe(400);
		expect(res.json().error.code).toBe("INVALID_FORMAT");
		expect(db.select().from(musicTracks).all()).toHaveLength(0);
	});

	it("rejects empty file upload and does not persist track", async () => {
		const { boundary, payload } = buildMultipartPayload(
			"empty.mp3",
			"audio/mpeg",
			Buffer.alloc(0),
		);

		const res = await app.inject({
			method: "POST",
			url: "/api/v1/music/tracks",
			headers: {
				cookie: adminCookie,
				"content-type": `multipart/form-data; boundary=${boundary}`,
			},
			payload,
		});

		expect(res.statusCode).toBe(400);
		expect(res.json().error.code).toBe("EMPTY_FILE");
		expect(db.select().from(musicTracks).all()).toHaveLength(0);
	});

	it("deletes a track, removes file from disk, and returns 404 for missing tracks", async () => {
		// Upload a track first
		const fileBuffer = Buffer.alloc(512, 0x4);
		const { boundary, payload } = buildMultipartPayload("to-delete.mp3", "audio/mpeg", fileBuffer);
		const uploadRes = await app.inject({
			method: "POST",
			url: "/api/v1/music/tracks",
			headers: {
				cookie: adminCookie,
				"content-type": `multipart/form-data; boundary=${boundary}`,
			},
			payload,
		});
		expect(uploadRes.statusCode).toBe(201);
		const { id } = uploadRes.json().data;

		const row = db.select().from(musicTracks).where(eq(musicTracks.id, id)).get();
		expect(row).toBeDefined();
		const filePath = row!.file_path;

		// Delete the track
		const deleteRes = await app.inject({
			method: "DELETE",
			url: `/api/v1/music/tracks/${id}`,
			headers: { cookie: adminCookie },
		});
		expect(deleteRes.statusCode).toBe(200);
		expect(deleteRes.json().ok).toBe(true);
		expect(db.select().from(musicTracks).where(eq(musicTracks.id, id)).get()).toBeUndefined();
		expect(existsSync(filePath)).toBe(false);

		// Deleting again returns 404
		const deleteAgainRes = await app.inject({
			method: "DELETE",
			url: `/api/v1/music/tracks/${id}`,
			headers: { cookie: adminCookie },
		});
		expect(deleteAgainRes.statusCode).toBe(404);
		expect(deleteAgainRes.json().error.code).toBe("NOT_FOUND");
	});

	it("rejects PATCH /volume with out-of-range or non-integer values", async () => {
		for (const bad of [-1, 101, 50.5, "loud"]) {
			const res = await app.inject({
				method: "PATCH",
				url: "/api/v1/music/volume",
				headers: { cookie: adminCookie },
				payload: { volume: bad },
			});
			expect(res.statusCode).toBe(400);
			expect(res.json().error.code).toBe("VALIDATION_ERROR");
		}
	});

	it("updates enabled/loop/shuffle mode settings and reflects them in status", async () => {
		const enableRes = await app.inject({
			method: "PATCH",
			url: "/api/v1/music/enabled",
			headers: { cookie: adminCookie },
			payload: { enabled: true },
		});
		expect(enableRes.statusCode).toBe(200);
		expect(
			db.select().from(appSettings).where(eq(appSettings.key, SETTING_KEYS.MUSIC_ENABLED)).get()
				?.value,
		).toBe("1");

		const modeRes = await app.inject({
			method: "PATCH",
			url: "/api/v1/music/mode",
			headers: { cookie: adminCookie },
			payload: { loop: false, shuffle: true },
		});
		expect(modeRes.statusCode).toBe(200);
		expect(
			db
				.select()
				.from(appSettings)
				.where(eq(appSettings.key, SETTING_KEYS.MUSIC_LOOP_ENABLED))
				.get()?.value,
		).toBe("0");
		expect(
			db
				.select()
				.from(appSettings)
				.where(eq(appSettings.key, SETTING_KEYS.MUSIC_SHUFFLE_ENABLED))
				.get()?.value,
		).toBe("1");

		const statusRes = await app.inject({
			method: "GET",
			url: "/api/v1/music/status",
			headers: { cookie: adminCookie },
		});
		expect(statusRes.statusCode).toBe(200);
		expect(statusRes.json().data.enabled).toBe(true);
		expect(statusRes.json().data.loop).toBe(false);
		expect(statusRes.json().data.shuffle).toBe(true);
	});
});
