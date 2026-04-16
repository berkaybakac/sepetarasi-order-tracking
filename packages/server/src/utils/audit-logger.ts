import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const isProduction = (process.env.NODE_ENV ?? "").toLowerCase() === "production";
const DEFAULT_DEV_LOG_PATH = join(process.cwd(), "data", "app.log");
const DEFAULT_PROD_LOG_PATH = "/var/log/sepetarasi/audit.log";

export interface AuditLogContext {
	actor?: string;
	ip?: string;
	requestId?: string;
	path?: string;
	orderId?: string;
	displayNo?: number;
}

interface AuditLogger {
	info: (obj: Record<string, unknown>, msg?: string) => void;
	error: (obj: Record<string, unknown>, msg?: string) => void;
}

function serializeError(error: unknown): { name: string; message: string } | string {
	if (error instanceof Error) {
		return { name: error.name, message: error.message };
	}
	return String(error);
}

function resolveLogFilePath(): string {
	const envPath = process.env.LOG_PATH?.trim();
	if (envPath) return envPath;
	return isProduction ? DEFAULT_PROD_LOG_PATH : DEFAULT_DEV_LOG_PATH;
}

function ensureLogDirectory(logFilePath: string) {
	try {
		mkdirSync(dirname(logFilePath), { recursive: true });
	} catch {
		// Ignore directory creation failures; stdout/stderr log still remains available.
	}
}

function createAuditRecord(action: string, details: string, context: AuditLogContext) {
	return {
		timestamp: new Date().toISOString(),
		level: "info",
		component: "audit",
		event: action,
		msg: details,
		action,
		details,
		...context,
	};
}

function createAuditLoggerPayload(action: string, details: string, context: AuditLogContext) {
	return {
		component: "audit",
		event: action,
		action,
		details,
		...context,
	};
}

function writeFallbackLog(level: "info" | "error", payload: Record<string, unknown>) {
	const stream = level === "error" ? process.stderr : process.stdout;
	stream.write(`${JSON.stringify(payload)}\n`);
}

export function auditLog(
	action: string,
	details: string,
	context: AuditLogContext = {},
	logger?: AuditLogger,
) {
	const payload = createAuditRecord(action, details, context);
	const loggerPayload = createAuditLoggerPayload(action, details, context);
	const logFilePath = resolveLogFilePath();

	if (logger) {
		logger.info(loggerPayload, details);
	} else {
		writeFallbackLog("info", payload);
	}

	try {
		ensureLogDirectory(logFilePath);
		appendFileSync(logFilePath, `${JSON.stringify(payload)}\n`, "utf-8");
	} catch (error) {
		const failurePayload = {
			component: "audit",
			event: "audit_log_write_failed",
			logFilePath,
			error: serializeError(error),
		};
		if (logger) {
			logger.error(failurePayload, "Audit log write failed");
		} else {
			writeFallbackLog("error", failurePayload);
		}
	}
}
