import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const logFilePath = process.env.LOG_PATH || join(process.cwd(), "data", "app.log");

// Ensure directory exists
try {
	mkdirSync(dirname(logFilePath), { recursive: true });
} catch (error) {
	// Ignore if exists
}

export interface AuditLogContext {
	actor?: string;
	ip?: string;
	requestId?: string;
	path?: string;
	orderId?: string;
	displayNo?: number;
}

function serializeError(error: unknown): { name: string; message: string } | string {
	if (error instanceof Error) {
		return { name: error.name, message: error.message };
	}
	return String(error);
}

export function auditLog(action: string, details: string, context: AuditLogContext = {}) {
	const logLine = JSON.stringify({
		timestamp: new Date().toISOString(),
		action,
		details,
		...context,
	});

	try {
		appendFileSync(logFilePath, `${logLine}\n`, "utf-8");
	} catch (error) {
		process.stderr.write(
			`${JSON.stringify({
				timestamp: new Date().toISOString(),
				level: "error",
				component: "audit-logger",
				event: "audit_log_write_failed",
				error: serializeError(error),
			})}\n`,
		);
	}
}
