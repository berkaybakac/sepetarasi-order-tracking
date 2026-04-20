import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statfsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import fastifyMultipart from "@fastify/multipart";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import {
	API_ROUTES,
	SETTING_KEYS,
	TB1_DISPLAY_PROFILE_ROUTES,
	WS_CHANNELS,
	formatRateLimitMessage,
	parseRetryAfterSeconds,
} from "@sepetarasi/shared";
import { eq } from "drizzle-orm";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import { ADMIN_COOKIE_NAME, AUTH_CONFIG, CASHIER_TOKEN_HEADER } from "./config/auth.js";
import type { AppDatabase } from "./db/connection.js";
import { appSettings } from "./db/schema.js";
import { buildTb1CompatDisplayHtml } from "./display/tb1-compat.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerMusicRoutes } from "./routes/music.js";
import { registerOrderRoutes } from "./routes/orders.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { registerStatsRoutes } from "./routes/stats.js";
import { AnnouncementService } from "./services/announcement.service.js";
import { AudioPlaybackService } from "./services/audio-playback.service.js";
import { MusicPlayerService } from "./services/music-player.service.js";
import { migrateLegacyMusicStorage } from "./services/music-storage-migration.service.js";
import { setNoStoreHeaders } from "./utils/http-cache.js";
import { AnnouncementWorker } from "./workers/announcement.worker.js";
import { Broadcaster } from "./ws/broadcaster.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HEARTBEAT_INTERVAL = 60000;
const HEARTBEAT_INTERVAL_LABEL = "60s";
const MAX_MUSIC_UPLOAD_BYTES = 500 * 1024 * 1024;
const DISPLAY_DIAGNOSTIC_PIXEL_GIF = Buffer.from(
	"R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
	"base64",
);

function normalizeDisplayDiagnosticField(value: unknown, maxLength = 240) {
	if (value === null || value === undefined) return undefined;
	const normalized = String(value).trim();
	if (normalized.length === 0) return undefined;
	if (normalized.length <= maxLength) return normalized;
	return `${normalized.slice(0, maxLength)}...`;
}

function relativizeUrl(url: string) {
	if (!url.startsWith("/") || url.startsWith("//")) return url;
	return `.${url}`;
}

function buildRelativeDisplayShellHtml(indexHtml: string) {
	return indexHtml
		.replace(/<html\b([^>]*)>/i, (_match, attrs) => {
			if (attrs.includes('data-display-probe="armed"')) {
				return `<html${attrs}>`;
			}
			return `<html${attrs} data-display-probe="armed">`;
		})
		.replace(/\b(href|src|data-src)=("([^"]*)"|'([^']*)')/g, (match, attr, _quoted, dq, sq) => {
			const url = typeof dq === "string" ? dq : sq;
			if (!url) return match;
			const quote = typeof dq === "string" ? '"' : "'";
			if (!url.startsWith("/") || url.startsWith("//")) return match;
			return `${attr}=${quote}${relativizeUrl(url)}${quote}`;
		})
		.replace(/url\((['"]?)\/([^)"']+)\1\)/g, (_match, quote, path) => {
			const resolvedQuote = quote ?? "";
			return `url(${resolvedQuote}./${path}${resolvedQuote})`;
		});
}

function replyRetryAfterSeconds(reply: FastifyReply) {
	return parseRetryAfterSeconds(reply.getHeader("retry-after"));
}

function wsClientRemoteAddress(request: FastifyRequest): string | undefined {
	return request.ip || request.socket?.remoteAddress || undefined;
}

function wsStatsSnapshot(broadcaster: Broadcaster) {
	return {
		activeClientCount: broadcaster.getAllClients().size,
		channelClientCounts: broadcaster.getStats(),
	};
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
	/** Path to uploaded music files directory */
	musicPath?: string;
	/** Optional filesystem path to inspect in health responses (e.g. DB directory). */
	healthDiskPath?: string;
	/** ALSA device for mpg123 on Linux (e.g. "hw:2,0"). Reads AUDIO_ALSA_DEVICE env var. */
	alsaDevice?: string;
	/** Disable static file serving (useful for tests) */
	disableStatic?: boolean;
	/** Override the static web root directory (useful for tests) */
	staticRootPath?: string;
	/** Max single MP3 upload size in bytes (default: 500MB) */
	musicUploadMaxBytes?: number;
}

export async function buildApp(opts: AppOptions) {
	const app = Fastify({ logger: true });
	const startedAt = Date.now();
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
			app.log.info(
				{
					event: "ws.connection.open",
					channel,
					connectionId,
					remoteAddress,
					...wsStatsSnapshot(broadcaster),
				},
				"WS connection opened",
			);

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
					const meta = wsMeta.get(ws);
					request.log.warn(
						{
							err,
							event: "ws.message.invalid",
							channel,
							connectionId: meta?.connectionId,
							remoteAddress: meta?.remoteAddress,
						},
						"Invalid WS message received",
					);
				}
			});
			ws.on("error", (err) => {
				const meta = wsMeta.get(ws);
				app.log.warn(
					{
						err,
						event: "ws.connection.error",
						channel,
						connectionId: meta?.connectionId,
						remoteAddress: meta?.remoteAddress,
						...wsStatsSnapshot(broadcaster),
					},
					"WS connection error",
				);
			});
			ws.on("close", (code, reasonBuffer) => {
				const meta = wsMeta.get(ws);
				const closeReason = reasonBuffer.toString() || undefined;
				app.log.info(
					{
						event: "ws.connection.closed",
						channel,
						connectionId: meta?.connectionId,
						remoteAddress: meta?.remoteAddress,
						closeCode: code,
						closeReason,
						...wsStatsSnapshot(broadcaster),
					},
					"WS connection closed",
				);
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
					error: { code: "VALIDATION_ERROR", message: "Gönderilen bilgiler eksik veya hatalı." },
				});
			}

			if ((error.statusCode ?? 500) === 429) {
				const retryAfterSeconds = replyRetryAfterSeconds(reply);
				return reply.status(429).send({
					ok: false,
					error: {
						code: "RATE_LIMITED",
						message: formatRateLimitMessage(retryAfterSeconds),
					},
					retryAfterSeconds,
				});
			}

			reply.send(error);
		},
	);

	// Setup Rate Limiting, Cookie, JWT
	// Keep only route-specific limits (auth brute-force, analytics, uploads).
	// A blanket global limiter was causing normal LAN traffic to trip 429s and break the admin UI.
	await app.register(fastifyRateLimit, { global: false });
	await app.register(fastifyCookie, { secret: AUTH_CONFIG.cookieSecret });
	await app.register(fastifyJwt, {
		secret: AUTH_CONFIG.jwtSecret,
		cookie: { cookieName: ADMIN_COOKIE_NAME, signed: false },
	});
	const musicUploadMaxBytes = opts.musicUploadMaxBytes ?? MAX_MUSIC_UPLOAD_BYTES;

	// Multipart support for music file uploads (streaming mode — no memory buffering)
	await app.register(fastifyMultipart, {
		attachFieldsToBody: false,
		limits: { fileSize: musicUploadMaxBytes, files: 1, parts: 10 },
	});

	// HTTP routes
	registerAuthRoutes(app, opts.db);
	registerOrderRoutes(app, opts.db, broadcaster);
	registerStatsRoutes(app, opts.db);

	// Music player
	const musicPath = opts.musicPath ?? join(__dirname, "../assets/music");
	const legacyMusicPath = join(__dirname, "../../assets/music");
	mkdirSync(musicPath, { recursive: true });
	await migrateLegacyMusicStorage({
		db: opts.db,
		musicPath,
		legacyMusicPath,
		logger: app.log.child({ component: "music-storage-migration" }),
	});

	let musicPlayer: MusicPlayerService | null = null;
	if (!opts.disableWorker) {
		musicPlayer = new MusicPlayerService({
			db: opts.db,
			broadcaster,
			alsaDevice: opts.alsaDevice,
			logger: app.log.child({ component: "music-player" }),
		});
	}

	registerSettingsRoutes(app, opts.db, broadcaster, musicPlayer);

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
			musicPlayer: musicPlayer ?? undefined,
			isAnnouncementEnabled: () => {
				const row = opts.db
					.select()
					.from(appSettings)
					.where(eq(appSettings.key, SETTING_KEYS.ANNOUNCEMENT_ENABLED))
					.get();
				return row ? row.value !== "0" : true;
			},
			pollIntervalMs: opts.workerPollIntervalMs ?? 1000,
			logger: app.log,
		});

		app.addHook("onReady", async () => {
			// Reset any announcements stuck in "playing" from a previous crashed/power-cycled run
			const stuckCount = announcementService.resetStuckAnnouncements();
			if (stuckCount > 0) {
				app.log.warn(
					{ event: "announcement.stuck.reset", count: stuckCount },
					`${stuckCount} stuck announcement(s) reset to pending on startup (previous crash or power-cycle)`,
				);
			}
			musicPlayer?.start();
			worker?.start();
		});

		app.addHook("onClose", async () => {
			musicPlayer?.stop();
			worker?.stop();
		});
	}

	// Health check
	app.get("/health", async (_request, reply) => {
		let dbOk = true;
		let dbError: string | undefined;
		try {
			opts.db.select({ key: appSettings.key }).from(appSettings).limit(1).all();
		} catch (error) {
			dbOk = false;
			dbError = error instanceof Error ? error.message : String(error);
		}

		let disk: {
			ok: boolean;
			path: string;
			freeBytes?: number;
			totalBytes?: number;
			usedBytes?: number;
			error?: string;
		} | null = null;
		if (opts.healthDiskPath) {
			try {
				const stats = statfsSync(opts.healthDiskPath);
				const totalBytes = stats.bsize * stats.blocks;
				const freeBytes = stats.bsize * stats.bavail;
				disk = {
					ok: true,
					path: opts.healthDiskPath,
					freeBytes,
					totalBytes,
					usedBytes: totalBytes - freeBytes,
				};
			} catch (error) {
				disk = {
					ok: false,
					path: opts.healthDiskPath,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		}

		const body = {
			ok: dbOk,
			data: {
				timestamp: new Date().toISOString(),
				uptime_s: Math.round((Date.now() - startedAt) / 1000),
				services: {
					db: dbOk ? { ok: true } : { ok: false, error: dbError },
					worker: {
						status: worker ? (worker.isRunning() ? "running" : "stopped") : "disabled",
					},
					audio: {
						disabled: opts.disableAudio ?? false,
						ttsFallbackEnabled: opts.enableTtsFallback ?? false,
						alsaDevice: opts.alsaDevice ?? null,
					},
				},
				websocket: wsStatsSnapshot(broadcaster),
				disk,
			},
		};

		if (!dbOk) {
			return reply.status(503).send(body);
		}

		return body;
	});

	const connectivityTestHtml = `<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Baglanti Testi</title>
    <style>
      html,
      body {
        height: 100%;
        margin: 0;
        background: #ffffff;
      }

      body {
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: Arial, sans-serif;
      }

      h1 {
        margin: 0;
        color: #111111;
        font-size: clamp(3rem, 12vw, 8rem);
        font-weight: 900;
        text-align: center;
        letter-spacing: 0.08em;
      }
    </style>
  </head>
  <body>
    <h1>BAĞLANTI BAŞARILI</h1>
  </body>
</html>`;

	const sendConnectivityTestHtml = async (_request: FastifyRequest, reply: FastifyReply) => {
		setNoStoreHeaders(reply);
		return reply.type("text/html; charset=utf-8").send(connectivityTestHtml);
	};

	app.get("/test.html", sendConnectivityTestHtml);
	app.get("/ping", sendConnectivityTestHtml);
	app.get("/display/index.html", async (_request, reply) => {
		setNoStoreHeaders(reply);
		return reply.type("text/html; charset=utf-8").send(buildTb1CompatDisplayHtml(null));
	});
	app.get(TB1_DISPLAY_PROFILE_ROUTES.led_256x512, async (_request, reply) => {
		setNoStoreHeaders(reply);
		return reply.type("text/html; charset=utf-8").send(buildTb1CompatDisplayHtml("led_256x512"));
	});
	app.get(TB1_DISPLAY_PROFILE_ROUTES.led_344_square, async (_request, reply) => {
		setNoStoreHeaders(reply);
		return reply.type("text/html; charset=utf-8").send(buildTb1CompatDisplayHtml("led_344_square"));
	});
	app.get(TB1_DISPLAY_PROFILE_ROUTES.led_512_square, async (_request, reply) => {
		setNoStoreHeaders(reply);
		return reply.type("text/html; charset=utf-8").send(buildTb1CompatDisplayHtml("led_512_square"));
	});
	app.get(
		"/display-beacon.gif",
		async (
			request: FastifyRequest<{
				Querystring: {
					phase?: string;
					detail?: string;
					source?: string;
					location?: string;
					path?: string;
					href?: string;
				};
			}>,
			reply,
		) => {
			setNoStoreHeaders(reply);
			request.log.info(
				{
					event: "display.client.diagnostic",
					phase: normalizeDisplayDiagnosticField(request.query.phase, 80) ?? "unknown",
					detail: normalizeDisplayDiagnosticField(request.query.detail),
					source: normalizeDisplayDiagnosticField(request.query.source),
					location: normalizeDisplayDiagnosticField(request.query.location, 80),
					path: normalizeDisplayDiagnosticField(request.query.path, 120),
					href: normalizeDisplayDiagnosticField(request.query.href, 240),
					userAgent: normalizeDisplayDiagnosticField(request.headers["user-agent"], 240),
				},
				"Display client diagnostic beacon",
			);
			return reply.type("image/gif").send(DISPLAY_DIAGNOSTIC_PIXEL_GIF);
		},
	);

	// Music API routes (available even without worker, returns null player gracefully)
	registerMusicRoutes(app, opts.db, musicPath, musicPlayer, musicUploadMaxBytes);

	// Serve web frontend in production
	if (!opts.disableStatic) {
		const webDistPath = opts.staticRootPath ?? join(__dirname, "../../web/dist");
		if (existsSync(webDistPath)) {
			const webIndexHtmlPath = join(webDistPath, "index.html");
			if (!existsSync(webIndexHtmlPath)) {
				throw new Error(
					`Static web dist found at "${webDistPath}" but index.html is missing. Run the web build before starting the server.`,
				);
			}
			const displayAliasHtml = buildRelativeDisplayShellHtml(
				readFileSync(webIndexHtmlPath, "utf8"),
			);

			await app.register(fastifyStatic, {
				root: webDistPath,
				prefix: "/",
				wildcard: false,
			});

			const sendDisplayShell = async (_request: FastifyRequest, reply: FastifyReply) => {
				setNoStoreHeaders(reply);
				return reply.sendFile("index.html", {
					cacheControl: false,
					etag: false,
					lastModified: false,
				});
			};

			app.get("/display", sendDisplayShell);
			app.get("/display/", sendDisplayShell);
			app.get("/display.html", async (_request, reply) => {
				setNoStoreHeaders(reply);
				return reply.type("text/html; charset=utf-8").send(displayAliasHtml);
			});

			// SPA fallback: serve index.html for non-API, non-WS routes
			app.setNotFoundHandler((request, reply) => {
				if (request.url.startsWith("/api/") || request.url.startsWith("/ws")) {
					return reply
						.status(404)
						.send({ ok: false, error: { code: "NOT_FOUND", message: "Sayfa bulunamadı." } });
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
