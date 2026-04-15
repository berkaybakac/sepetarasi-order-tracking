import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "../src/db/connection.js";
import { migrateLegacyMusicStorage } from "../src/services/music-storage-migration.service.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const dbPath = process.env.DB_PATH || "./data/sepetarasi.db";
const db = createDb(dbPath);

const logger = {
	info: (obj: Record<string, unknown>, msg = "music-path-migration") =>
		process.stdout.write(`${JSON.stringify({ level: "info", msg, ...obj })}\n`),
	warn: (obj: Record<string, unknown>, msg = "music-path-migration") =>
		process.stdout.write(`${JSON.stringify({ level: "warn", msg, ...obj })}\n`),
	error: (obj: Record<string, unknown>, msg = "music-path-migration") =>
		process.stderr.write(`${JSON.stringify({ level: "error", msg, ...obj })}\n`),
};

await migrateLegacyMusicStorage({
	db,
	musicPath: process.env.MUSIC_PATH || join(__dirname, "../assets/music"),
	legacyMusicPath: process.env.LEGACY_MUSIC_PATH || join(__dirname, "../../assets/music"),
	logger,
});

process.stdout.write("music path migration completed\n");
