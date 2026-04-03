import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDb } from "./db/connection.js";
import { buildApp } from "./app.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const port = Number(process.env.PORT) || 3000;
const dbPath = process.env.DB_PATH || "./data/sepetarasi.db";

mkdirSync(dirname(dbPath), { recursive: true });

const db = createDb(dbPath);

// Auto-migrate on startup
const migrationsFolder = resolve(__dirname, "db/migrations");
migrate(db, { migrationsFolder });

const app = await buildApp({ db });

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
		console.error(err);
		process.exit(1);
	}
	const lanIp = getLanIp();
	console.log(`
  Sepetarasi Order Tracking Server
  Local:   http://localhost:${port}
  LAN:     http://${lanIp}:${port}
`);
});
