import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import type { AppDatabase } from "./db/connection.js";
import { Broadcaster } from "./ws/broadcaster.js";
import { AnnouncementService } from "./services/announcement.service.js";
import { AnnouncementWorker } from "./workers/announcement.worker.js";
import { registerOrderRoutes } from "./routes/orders.js";
import { registerStatsRoutes } from "./routes/stats.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { WS_CHANNELS } from "@sepetarasi/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface AppOptions {
	db: AppDatabase;
	/** Disable announcement worker (useful for tests) */
	disableWorker?: boolean;
	/** Announcement delay in ms (default 2500) */
	announcementDelayMs?: number;
	/** Worker poll interval in ms (default 1000) */
	workerPollIntervalMs?: number;
	/** Disable audio playback in announcement worker (useful for tests) */
	disableAudio?: boolean;
	/** Path to pre-recorded MP3 files named {display_no}.mp3 */
	announcementsPath?: string;
	/** Disable static file serving (useful for tests) */
	disableStatic?: boolean;
}

export async function buildApp(opts: AppOptions) {
	const app = Fastify({ logger: false });
	const broadcaster = new Broadcaster();

	// Allow Electron/web clients to call API across origins (LAN IP, localhost, file://)
	app.addHook("onRequest", (request, reply, done) => {
		const origin = request.headers.origin;
		reply.header("Access-Control-Allow-Origin", origin ?? "*");
		reply.header("Vary", "Origin");
		reply.header("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
		reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

		if (request.method === "OPTIONS") {
			reply.code(204).send();
			return;
		}

		done();
	});

	// WebSocket
	await app.register(fastifyWebsocket);

	app.register(async (wsApp) => {
		wsApp.get("/ws", { websocket: true }, (socket, request) => {
			const url = new URL(request.url, "http://localhost");
			const channel = url.searchParams.get("channel") || WS_CHANNELS.ORDERS;

			const validChannels = Object.values(WS_CHANNELS) as string[];
			if (validChannels.includes(channel)) {
				broadcaster.subscribe(channel, socket);
			}

			socket.on("message", (data: { toString(): string }) => {
				try {
					const msg = JSON.parse(data.toString());
					if (msg.event === "ping") {
						socket.send(JSON.stringify({ event: "pong", timestamp: new Date().toISOString() }));
					}
				} catch {
					// Ignore invalid messages
				}
			});
		});
	});

	// HTTP routes
	registerOrderRoutes(app, opts.db, broadcaster);
	registerStatsRoutes(app, opts.db);
	registerSettingsRoutes(app, opts.db);

	// Health check
	app.get("/health", async () => ({ ok: true }));

	// Announcement worker
	let worker: AnnouncementWorker | null = null;
	if (!opts.disableWorker) {
		const announcementService = new AnnouncementService(opts.db);
		worker = new AnnouncementWorker({
			announcementService,
			broadcaster,
			delayMs: opts.announcementDelayMs ?? 2500,
			pollIntervalMs: opts.workerPollIntervalMs ?? 1000,
			disableAudio: opts.disableAudio ?? false,
			announcementsPath: opts.announcementsPath,
		});

		app.addHook("onReady", async () => {
			worker!.start();
		});

		app.addHook("onClose", async () => {
			worker!.stop();
		});
	}

	// Serve web frontend in production
	if (!opts.disableStatic) {
		const webDistPath = join(__dirname, "../../web/dist");
		if (existsSync(webDistPath)) {
			await app.register(fastifyStatic, {
				root: webDistPath,
				prefix: "/",
				wildcard: false,
			});

			// SPA fallback: serve index.html for non-API, non-WS routes
			app.setNotFoundHandler((request, reply) => {
				if (request.url.startsWith("/api/") || request.url.startsWith("/ws")) {
					return reply.status(404).send({ ok: false, error: { code: "NOT_FOUND", message: "Route not found" } });
				}
				return reply.sendFile("index.html");
			});
		}
	}

	// Expose for testing
	app.decorate("broadcaster", broadcaster);
	app.decorate("announcementWorker", worker);

	return app;
}
