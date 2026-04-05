import { mkdirSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { buildApp } from "./app.js";
import { createDb } from "./db/connection.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const port = Number(process.env.PORT) || 3000;
const dbPath = process.env.DB_PATH || "./data/sepetarasi.db";
const announcementsPath = process.env.ANNOUNCEMENTS_PATH;
const disableAudio = ["1", "true", "yes", "on"].includes(
	(process.env.DISABLE_AUDIO ?? "").toLowerCase(),
);
const enableTtsFallback = ["1", "true", "yes", "on"].includes(
	(process.env.ENABLE_TTS_FALLBACK ?? "").toLowerCase(),
);

mkdirSync(dirname(dbPath), { recursive: true });

const db = createDb(dbPath);

// Auto-migrate on startup
const migrationsFolder = resolve(__dirname, "db/migrations");
migrate(db, { migrationsFolder });

const app = await buildApp({ db, announcementsPath, disableAudio, enableTtsFallback });

function getLanIp(): string {
	const nets = networkInterfaces();
	for (const name of Object.keys(nets)) {
		for (const net of nets[name] || []) {
			if (net.family === "IPv4" && !net.internal) {
				return net.address;
			}
		}
	}
	return "localhost";
}

app.listen({ port, host: "0.0.0.0" }, (err) => {
	if (err) {
		app.log.error(err);
		process.exit(1);
	}
	const lanIp = getLanIp();
	app.log.info({ local: `http://localhost:${port}`, lan: `http://${lanIp}:${port}` }, "Sepetarasi Order Tracking Server started");
});
