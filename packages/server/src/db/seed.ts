import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DEFAULT_DISPLAY_SETTINGS } from "@sepetarasi/shared";
import { createDb } from "./connection.js";
import { appSettings, terminals } from "./schema.js";

const dbPath = process.env.DB_PATH || "./data/sepetarasi.db";
mkdirSync(dirname(dbPath), { recursive: true });

const db = createDb(dbPath);

// Seed app_settings defaults
const defaultSettings = [
	{ key: "announcement_delay_ms", value: "2500" },
	{ key: "business_name", value: "Sepetarasi" },
	{ key: "receipt_business_name", value: "Sepetarasi" },
	{ key: "receipt_address", value: "" },
	{ key: "receipt_phone", value: "" },
	{ key: "receipt_tax_id", value: "" },
	{ key: "receipt_tax_office", value: "" },
	...Object.entries(DEFAULT_DISPLAY_SETTINGS).map(([key, value]) => ({ key, value })),
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

process.stdout.write(
	`${JSON.stringify({
		timestamp: new Date().toISOString(),
		level: "info",
		component: "db-seed",
		event: "db.seed_completed",
		defaultSettingsCount: defaultSettings.length,
		msg: "Seed data inserted successfully",
	})}\n`,
);
