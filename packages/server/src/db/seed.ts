import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { appSettings, terminals } from "./schema.js";
import { createDb } from "./connection.js";

const dbPath = process.env.DB_PATH || "./data/sepetarasi.db";
mkdirSync(dirname(dbPath), { recursive: true });

const db = createDb(dbPath);

// Seed app_settings defaults
const defaultSettings = [
	{ key: "announcement_delay_ms", value: "2500" },
	{ key: "business_name", value: "Sepetarasi" },
	{ key: "display_no_reset_time", value: "06:00" },
];

for (const setting of defaultSettings) {
	db.insert(appSettings)
		.values({ ...setting, updated_at: new Date().toISOString() })
		.onConflictDoNothing()
		.run();
}

// Seed a test terminal
db.insert(terminals)
	.values({
		id: "terminal-kasa-1",
		name: "Kasa 1",
		type: "kasa",
		is_active: 1,
		created_at: new Date().toISOString(),
	})
	.onConflictDoNothing()
	.run();

console.log("Seed data inserted successfully.");
