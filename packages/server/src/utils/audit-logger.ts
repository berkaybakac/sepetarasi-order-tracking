import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const logFilePath = process.env.LOG_PATH || join(process.cwd(), "data", "app.log");

// Ensure directory exists
try {
	mkdirSync(dirname(logFilePath), { recursive: true });
} catch (error) {
	// Ignore if exists
}

export function auditLog(action: string, details: string) {
	const timestamp = new Date().toISOString();
	const logLine = `[${timestamp}] ${action} - ${details}\n`;

	try {
		appendFileSync(logFilePath, logLine, "utf-8");
	} catch (error) {
		console.error("Failed to write to audit log:", error);
	}
}
