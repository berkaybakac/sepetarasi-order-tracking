type LogLevel = "error" | "warn" | "info";

function write(level: LogLevel, scope: string, message: string, meta?: unknown) {
	if (!import.meta.env.DEV && level === "info") return;

	const prefix = `[${scope}] ${message}`;
	if (meta === undefined) {
		console[level](prefix);
		return;
	}
	console[level](prefix, meta);
}

export const logger = {
	error: (scope: string, message: string, meta?: unknown) => write("error", scope, message, meta),
	warn: (scope: string, message: string, meta?: unknown) => write("warn", scope, message, meta),
	info: (scope: string, message: string, meta?: unknown) => write("info", scope, message, meta),
};
