import { mkdirSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { createDb } from "./db/connection.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const port = Number(process.env.PORT) || 3000;
const dbPath = process.env.DB_PATH || "./data/sepetarasi.db";
const announcementsPath = process.env.ANNOUNCEMENTS_PATH;
const musicPath = process.env.MUSIC_PATH;
const disableAudio = ["1", "true", "yes", "on"].includes(
	(process.env.DISABLE_AUDIO ?? "").toLowerCase(),
);
const enableTtsFallback = ["1", "true", "yes", "on"].includes(
	(process.env.ENABLE_TTS_FALLBACK ?? "").toLowerCase(),
);
const alsaDevice = process.env.AUDIO_ALSA_DEVICE || undefined;
const SHUTDOWN_TIMEOUT_MS = 10000;

let appRef: FastifyInstance | null = null;
let shutdownPromise: Promise<void> | null = null;

function serializeError(
	error: unknown,
): { name: string; message: string; stack?: string } | string {
	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: error.stack,
		};
	}
	return String(error);
}

function writeStructuredProcessLog(
	level: "info" | "warn" | "error" | "fatal",
	event: string,
	msg: string,
	context: Record<string, unknown> = {},
) {
	const payload = {
		timestamp: new Date().toISOString(),
		level,
		component: "server-process",
		event,
		msg,
		pid: process.pid,
		...context,
	};
	const stream = level === "info" ? process.stdout : process.stderr;
	stream.write(`${JSON.stringify(payload)}\n`);
}

function logProcessEvent(
	level: "info" | "warn" | "error" | "fatal",
	event: string,
	msg: string,
	context: Record<string, unknown> = {},
) {
	if (appRef) {
		appRef.log[level](context, msg);
		return;
	}
	writeStructuredProcessLog(level, event, msg, context);
}

async function shutdown(reason: string, exitCode: number) {
	if (shutdownPromise) return shutdownPromise;

	shutdownPromise = (async () => {
		logProcessEvent("warn", "process.shutdown.requested", "Process shutdown requested", {
			event: "process.shutdown.requested",
			reason,
		});

		if (!appRef) {
			process.exit(exitCode);
		}

		const timeout = setTimeout(() => {
			logProcessEvent("fatal", "process.shutdown.timeout", "Graceful shutdown timed out", {
				event: "process.shutdown.timeout",
				reason,
				timeoutMs: SHUTDOWN_TIMEOUT_MS,
			});
			process.exit(1);
		}, SHUTDOWN_TIMEOUT_MS);
		timeout.unref();

		try {
			await appRef.close();
			clearTimeout(timeout);
			logProcessEvent("info", "process.shutdown.completed", "Process shutdown completed", {
				event: "process.shutdown.completed",
				reason,
			});
			process.exit(exitCode);
		} catch (error) {
			clearTimeout(timeout);
			logProcessEvent("fatal", "process.shutdown.failed", "Graceful shutdown failed", {
				event: "process.shutdown.failed",
				reason,
				error: serializeError(error),
			});
			process.exit(1);
		}
	})();

	return shutdownPromise;
}

process.once("SIGTERM", () => {
	void shutdown("SIGTERM", 0);
});

process.once("SIGINT", () => {
	void shutdown("SIGINT", 0);
});

process.once("uncaughtException", (error) => {
	logProcessEvent("fatal", "process.uncaught_exception", "Uncaught exception", {
		event: "process.uncaught_exception",
		error: serializeError(error),
	});
	void shutdown("uncaughtException", 1);
});

process.once("unhandledRejection", (reason) => {
	logProcessEvent("fatal", "process.unhandled_rejection", "Unhandled promise rejection", {
		event: "process.unhandled_rejection",
		error: serializeError(reason),
	});
	void shutdown("unhandledRejection", 1);
});

mkdirSync(dirname(dbPath), { recursive: true });

async function main() {
	const db = createDb(dbPath);

	// Auto-migrate on startup
	const migrationsFolder = resolve(__dirname, "db/migrations");
	migrate(db, { migrationsFolder });

	const app = await buildApp({
		db,
		announcementsPath,
		musicPath,
		healthDiskPath: dirname(dbPath),
		disableAudio,
		enableTtsFallback,
		alsaDevice,
	});
	appRef = app;

	function getLanIp(): string {
		const nets = networkInterfaces();
		for (const name of Object.keys(nets)) {
			for (const net of nets[name] || []) {
				if (net.family === "IPv4" && !net.internal) {
					return net.address;
				}
			}
		}
		return "localhost";
	}

	logProcessEvent("info", "process.startup.begin", "Server startup sequence started", {
		event: "process.startup.begin",
		port,
		dbPath,
	});

	if (disableAudio) {
		logProcessEvent(
			"warn",
			"audio.disabled_by_env",
			"Audio playback is disabled by DISABLE_AUDIO=true",
			{
				event: "audio.disabled_by_env",
				envVar: "DISABLE_AUDIO",
			},
		);
	}

	await app.listen({ port, host: "0.0.0.0" });
	const lanIp = getLanIp();
	app.log.info(
		{
			event: "process.startup.completed",
			local: `http://localhost:${port}`,
			lan: `http://${lanIp}:${port}`,
		},
		"Sepetarasi Order Tracking Server started",
	);
}

try {
	await main();
} catch (error) {
	logProcessEvent("fatal", "process.startup.failed", "Server startup failed", {
		event: "process.startup.failed",
		error: serializeError(error),
	});
	process.exit(1);
}
