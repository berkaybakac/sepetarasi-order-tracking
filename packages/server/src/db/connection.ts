import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export function createDb(dbPath: string) {
	const sqlite = new Database(dbPath);
	sqlite.pragma("journal_mode = WAL");
	sqlite.pragma("foreign_keys = ON");
	return drizzle(sqlite, { schema });
}

export function createMemoryDb() {
	const sqlite = new Database(":memory:");
	sqlite.pragma("foreign_keys = ON");
	return drizzle(sqlite, { schema });
}

export type AppDatabase = ReturnType<typeof createDb>;
