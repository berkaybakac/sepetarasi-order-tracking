import type { WsMessage } from "@sepetarasi/shared";
import { useCallback, useEffect, useRef } from "react";
import { getBaseUrl } from "../lib/api";

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

	const connect = useCallback(() => {
		const key = import.meta.env.VITE_WS_AUTH_KEY;

		if (!key) {
			console.error(
				"VITE_WS_AUTH_KEY is missing! WebSocket connection will likely fail for non-display channels.",
			);
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
						console.error(
							"WebSocket Unauthorized! This usually means VITE_WS_AUTH_KEY does not match the server's WS_AUTH_KEY. Please check your .env files and rebuild the app.",
						);
					}
					onMessage(msg);
				} catch (err) {
					console.error("WS message parse error:", err);
				}
			};

			ws.onclose = () => {
				onDisconnect?.();
				scheduleReconnect();
			};

			ws.onerror = () => {
				ws.close();
			};
		} catch {
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
