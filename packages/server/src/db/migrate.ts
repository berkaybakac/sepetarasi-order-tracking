import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDb } from "./connection.js";

const dbPath = process.env.DB_PATH || "./data/sepetarasi.db";
mkdirSync(dirname(dbPath), { recursive: true });

const db = createDb(dbPath);
migrate(db, { migrationsFolder: new URL("./migrations", import.meta.url).pathname });

process.stdout.write(
	`${JSON.stringify({
		timestamp: new Date().toISOString(),
		level: "info",
		component: "db-migrate",
		event: "db.migrations_applied",
		msg: "Migrations applied successfully",
	})}\n`,
);
