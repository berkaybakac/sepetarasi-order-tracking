import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
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
	{ key: "display_profile", value: "auto" },
	{ key: "display_layout", value: "auto" },
	{ key: "display_max_visible", value: "20" },
	{ key: "display_page_seconds", value: "8" },
	{ key: "restaurant_name", value: "SEPET ARASI" },
	{ key: "display_ready_minutes", value: "5" },
	{ key: "display_text_scale", value: "m" },
	{ key: "display_theme", value: "dark" },
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
