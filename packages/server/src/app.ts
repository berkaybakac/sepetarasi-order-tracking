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
	WS_CHANNELS,
	formatRateLimitMessage,
	parseRetryAfterSeconds,
} from "@sepetarasi/shared";
import { eq } from "drizzle-orm";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import { ADMIN_COOKIE_NAME, AUTH_CONFIG, CASHIER_TOKEN_HEADER } from "./config/auth.js";
import { GENERIC_API_RATE_LIMIT_MAX } from "./config/rate-limit.js";
import type { AppDatabase } from "./db/connection.js";
import { appSettings } from "./db/schema.js";
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

function buildTb1CompatDisplayHtml() {
	return `<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sepetarasi Display</title>
    <style>
      html,
      body {
        margin: 0;
        min-height: 100%;
        background: #08111f;
        color: #f8fafc;
        font-family: "Segoe UI", Arial, sans-serif;
      }

      body {
        min-height: 100vh;
      }

      .shell {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        border-bottom: 2px solid #1f2937;
        background: #0b1220;
      }

      .title {
        font-size: 26px;
        font-weight: 900;
        letter-spacing: 0.04em;
      }

      .clock {
        font-size: 24px;
        font-weight: 700;
      }

      .screen {
        flex: 1;
        display: flex;
        min-height: 0;
      }

      .screen.stack {
        flex-direction: column;
      }

      .panel {
        flex: 1;
        min-width: 0;
        min-height: 0;
        padding: 14px;
        box-sizing: border-box;
      }

      .panel.preparing {
        background: #21110a;
        border-right: 2px solid rgba(217, 119, 6, 0.35);
      }

      .screen.stack .panel.preparing {
        border-right: 0;
        border-bottom: 2px solid rgba(217, 119, 6, 0.35);
      }

      .panel.ready {
        background: #08180f;
      }

      .panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
      }

      .panel-title {
        font-size: 24px;
        font-weight: 900;
        letter-spacing: 0.03em;
      }

      .panel.preparing .panel-title {
        color: #fbbf24;
      }

      .panel.ready .panel-title {
        color: #4ade80;
      }

      .panel-count {
        min-width: 54px;
        padding: 6px 10px;
        border-radius: 999px;
        text-align: center;
        font-size: 22px;
        font-weight: 900;
      }

      .panel.preparing .panel-count {
        background: rgba(251, 191, 36, 0.16);
        border: 1px solid rgba(251, 191, 36, 0.45);
        color: #fef3c7;
      }

      .panel.ready .panel-count {
        background: rgba(74, 222, 128, 0.16);
        border: 1px solid rgba(74, 222, 128, 0.45);
        color: #dcfce7;
      }

      .list {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .screen.stack .list {
        grid-template-columns: repeat(1, minmax(0, 1fr));
      }

      .item {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 88px;
        border-radius: 16px;
        border: 2px solid rgba(255, 255, 255, 0.08);
        font-size: 42px;
        font-weight: 900;
        letter-spacing: 0.02em;
      }

      .panel.preparing .item {
        background: rgba(251, 191, 36, 0.1);
        border-color: rgba(251, 191, 36, 0.28);
        color: #fef3c7;
      }

      .panel.ready .item {
        background: rgba(74, 222, 128, 0.1);
        border-color: rgba(74, 222, 128, 0.28);
        color: #dcfce7;
      }

      .item.empty {
        justify-content: flex-start;
        padding: 18px 16px;
        font-size: 26px;
        font-weight: 700;
        letter-spacing: 0;
        opacity: 0.86;
      }

      .footer {
        padding: 10px 14px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        font-size: 18px;
        font-weight: 700;
        color: #cbd5e1;
        background: #0b1220;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="header">
        <div class="title" id="restaurant-name">SEPET ARASI</div>
        <div class="clock" id="clock">--:--</div>
      </div>
      <div class="screen stack" id="screen">
        <div class="panel preparing">
          <div class="panel-head">
            <div class="panel-title">Hazırlananlar</div>
            <div class="panel-count" id="prep-count">0</div>
          </div>
          <div class="list" id="prep-list">
            <div class="item empty">Yükleniyor...</div>
          </div>
        </div>
        <div class="panel ready">
          <div class="panel-head">
            <div class="panel-title">Hazır</div>
            <div class="panel-count" id="ready-count">0</div>
          </div>
          <div class="list" id="ready-list">
            <div class="item empty">Yükleniyor...</div>
          </div>
        </div>
      </div>
      <div class="footer" id="footer-status">TB1 uyumlu ekran hazırlanıyor</div>
    </div>
    <script>
      (function () {
        var ORDERS_URL = "${API_ROUTES.V1.ORDERS}";
        var SETTINGS_URL = "${API_ROUTES.V1.SETTINGS_PUBLIC}";
        var BEACON_URL = "/display-beacon.gif";
        var state = {
          orders: [],
          config: {
            restaurantName: "SEPET ARASI",
            profile: "led_256x512",
            layoutPreference: "stack",
            maxVisiblePerColumn: 4,
            pageSeconds: 6,
            readyDisplayMinutes: 5
          },
          preparingPage: 0,
          readyPage: 0,
          nextPageSwitchAt: 0
        };

        var screen = document.getElementById("screen");
        var prepList = document.getElementById("prep-list");
        var readyList = document.getElementById("ready-list");
        var prepCount = document.getElementById("prep-count");
        var readyCount = document.getElementById("ready-count");
        var footerStatus = document.getElementById("footer-status");
        var restaurantName = document.getElementById("restaurant-name");
        var clock = document.getElementById("clock");

        function safeString(value) {
          if (value === null || value === undefined) return "";
          return String(value);
        }

        function sendDiagnostic(phase, detail) {
          try {
            var img = new Image();
            img.src =
              BEACON_URL +
              "?phase=" + encodeURIComponent(phase) +
              "&detail=" + encodeURIComponent(detail || "") +
              "&path=" + encodeURIComponent("/display/index.html");
            window.__tb1CompatBeacon = img;
          } catch (_error) {}
        }

        function setStatus(text) {
          footerStatus.textContent = text;
        }

        function requestJson(url, onSuccess, onError) {
          var xhr = new XMLHttpRequest();
          xhr.open("GET", url, true);
          xhr.onreadystatechange = function () {
            var payload;

            if (xhr.readyState !== 4) return;

            if (xhr.status < 200 || xhr.status >= 300) {
              onError("HTTP " + xhr.status);
              return;
            }

            try {
              payload = JSON.parse(xhr.responseText);
            } catch (_error) {
              onError("INVALID_JSON");
              return;
            }

            if (!payload || payload.ok !== true) {
              onError("API_ERROR");
              return;
            }

            onSuccess(payload.data);
          };
          xhr.onerror = function () {
            onError("NETWORK_ERROR");
          };
          xhr.send();
        }

        function parsePositiveInt(value, fallbackValue) {
          var numberValue = Number(value);
          if (!isFinite(numberValue) || numberValue < 1 || Math.floor(numberValue) !== numberValue) {
            return fallbackValue;
          }
          return numberValue;
        }

        function applySettings(settings) {
          state.config.restaurantName = safeString(settings.restaurant_name || "SEPET ARASI");
          state.config.profile = safeString(settings.display_profile || "auto");
          state.config.layoutPreference = safeString(settings.display_layout || "auto");
          state.config.maxVisiblePerColumn = parsePositiveInt(settings.display_max_visible, 4);
          state.config.pageSeconds = parsePositiveInt(settings.display_page_seconds, 6);
          state.config.readyDisplayMinutes = parsePositiveInt(settings.display_ready_minutes, 5);
          restaurantName.textContent = state.config.restaurantName || "SEPET ARASI";
          state.nextPageSwitchAt = Date.now() + state.config.pageSeconds * 1000;
        }

        function isReadyVisible(order) {
          var readyAt;
          var diffMinutes;

          if (order.status !== "READY") return false;
          if (!order.ready_at) return true;

          readyAt = new Date(order.ready_at).getTime();
          if (!isFinite(readyAt)) return true;

          diffMinutes = (Date.now() - readyAt) / 60000;
          return diffMinutes <= state.config.readyDisplayMinutes;
        }

        function sortByDisplayNo(left, right) {
          return Number(left.display_no || 0) - Number(right.display_no || 0);
        }

        function getPreparingOrders() {
          return state.orders.filter(function (order) {
            return order.status === "PREPARING";
          }).sort(sortByDisplayNo);
        }

        function getReadyOrders() {
          return state.orders.filter(isReadyVisible).sort(sortByDisplayNo);
        }

        function getPageCount(totalItems, pageSize) {
          var safePageSize = Math.max(1, pageSize);
          if (totalItems <= 0) return 1;
          return Math.max(1, Math.ceil(totalItems / safePageSize));
        }

        function getPageSlice(items, pageSize, pageIndex) {
          var safePageSize = Math.max(1, pageSize);
          var pageCount = getPageCount(items.length, safePageSize);
          var boundedPage = pageIndex % pageCount;
          var start = boundedPage * safePageSize;
          return items.slice(start, start + safePageSize);
        }

        function isStackLayout() {
          var width = window.innerWidth || 0;
          var height = window.innerHeight || 0;

          if (state.config.layoutPreference === "stack") return true;
          if (state.config.layoutPreference === "split") return false;
          if (state.config.profile === "led_256x512") return true;
          if (height > width) return true;
          return width < 840;
        }

        function renderItems(container, items, emptyText) {
          var fragment = document.createDocumentFragment();
          var item;
          var node;
          var index;

          container.innerHTML = "";

          if (!items.length) {
            node = document.createElement("div");
            node.className = "item empty";
            node.appendChild(document.createTextNode(emptyText));
            container.appendChild(node);
            return;
          }

          for (index = 0; index < items.length; index += 1) {
            item = items[index];
            node = document.createElement("div");
            node.className = "item";
            node.appendChild(document.createTextNode("#" + safeString(item.display_no)));
            fragment.appendChild(node);
          }

          container.appendChild(fragment);
        }

        function renderClock() {
          var now = new Date();
          var hours = now.getHours();
          var minutes = now.getMinutes();
          clock.textContent =
            (hours < 10 ? "0" : "") + hours + ":" + (minutes < 10 ? "0" : "") + minutes;
        }

        function render() {
          var preparingOrders = getPreparingOrders();
          var readyOrders = getReadyOrders();
          var pageSize = Math.max(1, state.config.maxVisiblePerColumn);
          var preparingPageCount = getPageCount(preparingOrders.length, pageSize);
          var readyPageCount = getPageCount(readyOrders.length, pageSize);

          if (state.preparingPage >= preparingPageCount) state.preparingPage = 0;
          if (state.readyPage >= readyPageCount) state.readyPage = 0;

          prepCount.textContent = safeString(preparingOrders.length);
          readyCount.textContent = safeString(readyOrders.length);
          screen.className = "screen " + (isStackLayout() ? "stack" : "split");

          renderItems(
            prepList,
            getPageSlice(preparingOrders, pageSize, state.preparingPage),
            "Bekleyen sipariş yok",
          );
          renderItems(
            readyList,
            getPageSlice(readyOrders, pageSize, state.readyPage),
            "Hazır sipariş yok",
          );
        }

        function maybeAdvancePages() {
          var now = Date.now();
          var preparingPageCount = getPageCount(getPreparingOrders().length, state.config.maxVisiblePerColumn);
          var readyPageCount = getPageCount(getReadyOrders().length, state.config.maxVisiblePerColumn);

          if (now < state.nextPageSwitchAt) return;

          state.preparingPage = (state.preparingPage + 1) % preparingPageCount;
          state.readyPage = (state.readyPage + 1) % readyPageCount;
          state.nextPageSwitchAt = now + state.config.pageSeconds * 1000;
          render();
        }

        function loadSettings() {
          requestJson(
            SETTINGS_URL,
            function (data) {
              applySettings(data || {});
              render();
              setStatus("Ayarlar alındı");
              sendDiagnostic("tb1-compat-settings-ok");
            },
            function (errorCode) {
              setStatus("Ayarlar alınamadı: " + errorCode);
              sendDiagnostic("tb1-compat-settings-failed", errorCode);
            },
          );
        }

        function loadOrders() {
          requestJson(
            ORDERS_URL,
            function (data) {
              state.orders = data || [];
              render();
              setStatus("Siparişler güncellendi");
              sendDiagnostic("tb1-compat-orders-ok", String(state.orders.length));
            },
            function (errorCode) {
              setStatus("Siparişler alınamadı: " + errorCode);
              sendDiagnostic("tb1-compat-orders-failed", errorCode);
            },
          );
        }

        sendDiagnostic("tb1-compat-inline-start");
        renderClock();
        render();
        loadSettings();
        loadOrders();

        if (typeof window.addEventListener === "function") {
          window.addEventListener("resize", render);
        }

        window.setInterval(renderClock, 1000);
        window.setInterval(loadOrders, 1500);
        window.setInterval(loadSettings, 30000);
        window.setInterval(maybeAdvancePages, 1000);
      })();
    </script>
  </body>
</html>`;
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
		})
		.replace(
			/<body([^>]*)>/i,
			'<body$1><div id="display-static-probe"><div class="display-static-probe-title">DISPLAY.HTML SHELL YUKLENDI</div><div class="display-static-probe-subtitle">BURADA KALIYORSA TB1 JAVASCRIPT CALISTIRAMIYOR</div></div>',
		);
}

function replyRetryAfterSeconds(reply: FastifyReply) {
	return parseRetryAfterSeconds(reply.getHeader("retry-after"));
}

function shouldBypassGenericRateLimit(request: FastifyRequest) {
	const url = request.raw.url ?? request.url ?? "";
	return request.method === "OPTIONS" || (!url.startsWith("/api/") && !url.startsWith("/ws"));
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
					error: { code: "VALIDATION_ERROR", message: error.message },
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
	// Keep a generous default for API routes, but do not throttle local display/static/health flows.
	await app.register(fastifyRateLimit, {
		max: GENERIC_API_RATE_LIMIT_MAX,
		timeWindow: "1 minute",
		allowList: shouldBypassGenericRateLimit,
	});
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
	registerSettingsRoutes(app, opts.db, broadcaster);

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
		return reply.type("text/html; charset=utf-8").send(buildTb1CompatDisplayHtml());
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
		const webDistPath = join(__dirname, "../../web/dist");
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
