import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createMemoryDb } from "./connection.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(__dirname, "migrations");

/** Creates a fresh in-memory DB with migrations applied. Use per-test for isolation. */
export function createTestDb() {
	const db = createMemoryDb();
	migrate(db, { migrationsFolder });
	return db;
}
