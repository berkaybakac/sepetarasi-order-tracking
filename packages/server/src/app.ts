import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import { SETTING_KEYS, WS_CHANNELS } from "@sepetarasi/shared";
import { eq } from "drizzle-orm";
import Fastify, { type FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import { ADMIN_COOKIE_NAME, AUTH_CONFIG, CASHIER_TOKEN_HEADER } from "./config/auth.js";
import type { AppDatabase } from "./db/connection.js";
import { appSettings } from "./db/schema.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerOrderRoutes } from "./routes/orders.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { registerStatsRoutes } from "./routes/stats.js";
import { AnnouncementService } from "./services/announcement.service.js";
import { AudioPlaybackService } from "./services/audio-playback.service.js";
import { AnnouncementWorker } from "./workers/announcement.worker.js";
import { Broadcaster } from "./ws/broadcaster.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HEARTBEAT_INTERVAL = 60000;
const HEARTBEAT_INTERVAL_LABEL = "60s";

function wsClientRemoteAddress(request: FastifyRequest): string | undefined {
	return request.ip || request.socket?.remoteAddress || undefined;
}

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
	/** Enable TTS fallback when MP3 is missing or player fails (default false for MVP) */
	enableTtsFallback?: boolean;
	/** Path to pre-recorded MP3 files named {display_no}.mp3 */
	announcementsPath?: string;
	/** ALSA device for mpg123 on Linux (e.g. "hw:2,0"). Reads AUDIO_ALSA_DEVICE env var. */
	alsaDevice?: string;
	/** Disable static file serving (useful for tests) */
	disableStatic?: boolean;
}

export async function buildApp(opts: AppOptions) {
	const app = Fastify({ logger: true });
	const broadcaster = new Broadcaster();
	const wsAlive = new WeakMap<WebSocket, boolean>();
	const wsMeta = new WeakMap<
		WebSocket,
		{ connectionId: string; channels: string[]; remoteAddress?: string }
	>();

	// Allow Electron/web clients to call API across origins (LAN IP, localhost, file://)
	app.addHook("onRequest", (request, reply, done) => {
		const origin = request.headers.origin;
		reply.header("Access-Control-Allow-Origin", origin ?? "*");
		reply.header("Vary", "Origin");
		reply.header("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
		reply.header(
			"Access-Control-Allow-Headers",
			`Content-Type, Authorization, ${CASHIER_TOKEN_HEADER}`,
		);

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
			const ws = socket as unknown as WebSocket;
			const url = new URL(request.url, "http://localhost");
			const channel = url.searchParams.get("channel") || WS_CHANNELS.ORDERS;
			const key = url.searchParams.get("key");

			// Only require key for non-display channels (orders, admin, etc.)
			if (channel !== WS_CHANNELS.DISPLAY && key !== AUTH_CONFIG.wsAuthKey) {
				request.log.warn(
					{
						channel,
						receivedKeyMasked: key ? `${key.slice(0, 3)}...${key.slice(-3)}` : "missing",
						expectedKeyMasked: `${AUTH_CONFIG.wsAuthKey.slice(0, 3)}...${AUTH_CONFIG.wsAuthKey.slice(-3)}`,
					},
					"Unauthorized WS connection attempt - Key mismatch",
				);
				socket.send(JSON.stringify({ event: "error", message: "Unauthorized" }));
				socket.close();
				return;
			}

			const validChannels = Object.values(WS_CHANNELS) as string[];
			if (validChannels.includes(channel)) {
				broadcaster.subscribe(channel, ws);
			}

			// Heartbeat: Mark as alive on connection and on pong (Display clients are typically listen-only)
			const connectionId = randomUUID().slice(0, 8);
			const remoteAddress = wsClientRemoteAddress(request);
			wsMeta.set(ws, { connectionId, channels: [channel], remoteAddress });

			wsAlive.set(ws, true);
			ws.on("pong", () => {
				wsAlive.set(ws, true);
			});
			ws.on("message", (data: { toString(): string }) => {
				// Lenient: any inbound message also counts as alive
				wsAlive.set(ws, true);
				try {
					const msg = JSON.parse(data.toString());
					if (msg.event === "ping") {
						ws.send(JSON.stringify({ event: "pong", timestamp: new Date().toISOString() }));
					}
				} catch (err) {
					request.log.warn({ err }, "Invalid WS message received");
				}
			});
		});
	});

	// Active Heartbeat: Periodically check and cleanup ghost connections
	const heartbeatInterval = setInterval(() => {
		const clients = broadcaster.getAllClients();
		for (const socket of clients) {
			if (socket.readyState !== socket.OPEN) continue;

			const alive = wsAlive.get(socket) ?? true;
			if (!alive) {
				const meta = wsMeta.get(socket);
				app.log.warn(
					{
						reason: "heartbeat_timeout",
						interval: HEARTBEAT_INTERVAL_LABEL,
						remoteAddress: meta?.remoteAddress,
						channels: meta?.channels,
						connectionId: meta?.connectionId,
					},
					"Terminating ghost WS connection",
				);
				socket.terminate();
				continue;
			}

			// Expect a pong before next interval tick
			wsAlive.set(socket, false);
			try {
				socket.ping();
			} catch (err) {
				const meta = wsMeta.get(socket);
				app.log.debug(
					{
						err,
						reason: "heartbeat_ping_failed",
						interval: HEARTBEAT_INTERVAL_LABEL,
						remoteAddress: meta?.remoteAddress,
						channels: meta?.channels,
						connectionId: meta?.connectionId,
					},
					"WS ping failed; will terminate if no pong next tick",
				);
				// If ping fails, let the next tick terminate if it stays non-responsive
			}
		}
	}, HEARTBEAT_INTERVAL);

	app.addHook("onClose", async () => {
		clearInterval(heartbeatInterval);
	});

	// Normalize Fastify schema validation errors to our API error format
	app.setErrorHandler(
		(error: { validation?: unknown; message: string; statusCode?: number }, _request, reply) => {
			if (error.validation) {
				return reply.status(400).send({
					ok: false,
					error: { code: "VALIDATION_ERROR", message: error.message },
				});
			}
			reply.send(error);
		},
	);

	// Setup Rate Limiting, Cookie, JWT
	// Keep a sane default for all routes. Auth route applies its own tighter guard.
	await app.register(fastifyRateLimit, { max: 100, timeWindow: "1 minute" });
	await app.register(fastifyCookie, { secret: AUTH_CONFIG.cookieSecret });
	await app.register(fastifyJwt, {
		secret: AUTH_CONFIG.jwtSecret,
		cookie: { cookieName: ADMIN_COOKIE_NAME, signed: false },
	});

	// HTTP routes
	registerAuthRoutes(app, opts.db);
	registerOrderRoutes(app, opts.db, broadcaster);
	registerStatsRoutes(app, opts.db);
	registerSettingsRoutes(app, opts.db);

	// Health check
	app.get("/health", async () => ({ ok: true }));

	// Announcement worker
	let worker: AnnouncementWorker | null = null;
	if (!opts.disableWorker) {
		const announcementService = new AnnouncementService(opts.db);
		const audioPlayer = new AudioPlaybackService({
			disableAudio: opts.disableAudio ?? false,
			enableTtsFallback: opts.enableTtsFallback ?? false,
			announcementsPath: opts.announcementsPath,
			alsaDevice: opts.alsaDevice,
			delayMs: opts.announcementDelayMs ?? 2500,
			logger: app.log.child({ component: "audio-playback" }),
			getVolume: () => {
				const row = opts.db
					.select()
					.from(appSettings)
					.where(eq(appSettings.key, SETTING_KEYS.AUDIO_VOLUME))
					.get();
				return row ? Math.max(0, Math.min(100, Number(row.value))) : 100;
			},
		});
		worker = new AnnouncementWorker({
			announcementService,
			broadcaster,
			audioPlayer,
			pollIntervalMs: opts.workerPollIntervalMs ?? 1000,
			logger: app.log,
		});

		app.addHook("onReady", async () => {
			// Reset any announcements stuck in "playing" from a previous crashed/power-cycled run
			announcementService.resetStuckAnnouncements();
			worker?.start();
		});

		app.addHook("onClose", async () => {
			worker?.stop();
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
					return reply
						.status(404)
						.send({ ok: false, error: { code: "NOT_FOUND", message: "Route not found" } });
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
