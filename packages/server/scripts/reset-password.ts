import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SETTING_KEYS } from "@sepetarasi/shared";
import { eq } from "drizzle-orm";
import { createDb } from "../src/db/connection.js";
import { appSettings } from "../src/db/schema.js";

// Establish path relative to scripts directory
const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || join(__dirname, "../../data/sepetarasi.db");

const db = createDb(dbPath);

console.log("Şifre Sıfırlama Aracı Başlatıldı...");

// Delete the stored admin password hash
const result = db
	.delete(appSettings)
	.where(eq(appSettings.key, SETTING_KEYS.ADMIN_PASSWORD_HASH))
	.run();

if (result.changes > 0) {
	console.log("Başarılı: Admin parolası sistemden silindi.");
	console.log("ℹLütfen sunucuyu (agent) yeniden başlatın.");
	console.log("ℹSunucu açıldığında şifre otomatik olarak 'admin123' olarak belirlenecektir.");
} else {
	console.log(
		"Uyarı: Veritabanında zaten bir parola kaydı bulunamadı (Büyük ihtimalle şifre zaten admin123).",
	);
}
