import type { WsMessage } from "@sepetarasi/shared";
import { useCallback, useEffect, useRef } from "react";
import { getBaseUrl } from "../lib/api";
import { reportRendererError, reportRendererWarning } from "../lib/electron";

interface UseWebSocketOptions {
	channel: string;
	onMessage: (msg: WsMessage) => void;
	onConnect?: () => void;
	onDisconnect?: () => void;
}

export function useWebSocket({ channel, onMessage, onConnect, onDisconnect }: UseWebSocketOptions) {
	const wsRef = useRef<WebSocket | null>(null);
	const reconnectAttempt = useRef(0);
	const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const unauthorizedLogged = useRef(false);
	const missingKeyLogged = useRef(false);

	const connect = useCallback(() => {
		const key = import.meta.env.VITE_WS_AUTH_KEY;

		if (!key && !missingKeyLogged.current) {
			missingKeyLogged.current = true;
			reportRendererWarning({
				component: "websocket",
				event: "ws.auth_key_missing",
				message:
					"VITE_WS_AUTH_KEY eksik! packages/kasa/.env dosyasına ekle: VITE_WS_AUTH_KEY=<server .env'deki WS_AUTH_KEY ile aynı değer>",
				context: { channel },
			});
		}

		const wsUrl = `${getBaseUrl().replace(/^http/, "ws")}/ws?channel=${channel}${key ? `&key=${encodeURIComponent(key)}` : ""}`;

		try {
			const ws = new WebSocket(wsUrl);
			wsRef.current = ws;

			ws.onopen = () => {
				reconnectAttempt.current = 0;
				onConnect?.();
			};

			ws.onmessage = (event) => {
				try {
					const msg: WsMessage = JSON.parse(event.data);
					if (msg.event === "error" && msg.message === "Unauthorized") {
						if (!unauthorizedLogged.current) {
							unauthorizedLogged.current = true;
							reportRendererError({
								component: "websocket",
								event: "ws.unauthorized",
								message:
									"WebSocket Unauthorized! This usually means VITE_WS_AUTH_KEY does not match the server's WS_AUTH_KEY. Please check your .env files and rebuild the app.",
								context: { channel, baseUrl: getBaseUrl() },
							});
						}
					}
					onMessage(msg);
				} catch (err) {
					reportRendererError({
						component: "websocket",
						event: "ws.message_parse_failed",
						message: "WS message parse error",
						error: err,
						context: { channel },
					});
				}
			};

			ws.onclose = () => {
				onDisconnect?.();
				scheduleReconnect();
			};

			ws.onerror = () => {
				ws.close();
			};
		} catch (error) {
			reportRendererError({
				component: "websocket",
				event: "ws.connection_init_failed",
				message: "WebSocket connection initialization failed",
				error,
				context: { channel, baseUrl: getBaseUrl() },
			});
			scheduleReconnect();
		}
	}, [channel, onMessage, onConnect, onDisconnect]);

	const scheduleReconnect = useCallback(() => {
		const baseDelay = Math.min(1000 * 2 ** reconnectAttempt.current, 30000);
		// Add jitter to avoid thundering herd reconnects when multiple clients drop together.
		const jitter = Math.floor(baseDelay * (0.2 * Math.random()));
		const delay = baseDelay + jitter;
		reconnectAttempt.current++;
		reconnectTimer.current = setTimeout(connect, delay);
	}, [connect]);

	useEffect(() => {
		connect();

		return () => {
			clearTimeout(reconnectTimer.current);
			wsRef.current?.close();
		};
	}, [connect]);

	return wsRef;
}
