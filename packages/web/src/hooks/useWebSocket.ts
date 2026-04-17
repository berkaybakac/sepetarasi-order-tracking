import type { WsMessage } from "@sepetarasi/shared";
import { useEffect, useEffectEvent, useRef } from "react";
import { logger } from "../lib/logger";

interface UseWebSocketOptions {
	channel: string;
	onMessage: (msg: WsMessage) => void;
	onConnect?: () => void;
	onDisconnect?: () => void;
}

export function useWebSocket({ channel, onMessage, onConnect, onDisconnect }: UseWebSocketOptions) {
	const wsRef = useRef<WebSocket | null>(null);
	const reconnectAttempt = useRef(0);
	const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const handleMessage = useEffectEvent(onMessage);
	const handleConnect = useEffectEvent(() => onConnect?.());
	const handleDisconnect = useEffectEvent(() => onDisconnect?.());

	useEffect(() => {
		let disposed = false;
		const protocol = location.protocol === "https:" ? "wss:" : "ws:";
		const key = import.meta.env.VITE_WS_AUTH_KEY;

		if (!key) {
			logger.warn(
				"useWebSocket",
				"VITE_WS_AUTH_KEY is missing. Authenticated websocket channels may fail.",
			);
		}

		const clearReconnectTimer = () => {
			if (reconnectTimer.current) {
				clearTimeout(reconnectTimer.current);
				reconnectTimer.current = null;
			}
		};

		const scheduleReconnect = (delayMs: number) => {
			if (disposed) return;
			clearReconnectTimer();
			reconnectTimer.current = setTimeout(() => {
				reconnectTimer.current = null;
				connect();
			}, delayMs);
		};

		const connect = () => {
			if (disposed) return;
			const wsUrl = `${protocol}//${location.host}/ws?channel=${channel}${key ? `&key=${encodeURIComponent(key)}` : ""}`;

			try {
				const ws = new WebSocket(wsUrl);
				wsRef.current = ws;

				ws.onopen = () => {
					reconnectAttempt.current = 0;
					handleConnect();
				};

				ws.onmessage = (event) => {
					try {
						const msg: WsMessage = JSON.parse(event.data);
						if (msg.event === "error" && msg.message === "Unauthorized") {
							logger.error(
								"useWebSocket",
								"WebSocket Unauthorized. Check VITE_WS_AUTH_KEY and server WS_AUTH_KEY.",
							);
						}
						handleMessage(msg);
					} catch (error) {
						logger.error("useWebSocket", "WS message parse error.", error);
					}
				};

				ws.onclose = () => {
					handleDisconnect();
					if (wsRef.current === ws) {
						wsRef.current = null;
					}
					if (disposed) return;
					const baseDelay = Math.min(1000 * 2 ** reconnectAttempt.current, 30_000);
					const jitter = Math.floor(baseDelay * (0.2 * Math.random()));
					reconnectAttempt.current += 1;
					scheduleReconnect(baseDelay + jitter);
				};

				ws.onerror = () => {
					ws.close();
				};
			} catch (error) {
				logger.warn("useWebSocket", "Initial websocket connection failed; retry scheduled.", error);
				const baseDelay = Math.min(1000 * 2 ** reconnectAttempt.current, 30_000);
				const jitter = Math.floor(baseDelay * (0.2 * Math.random()));
				reconnectAttempt.current += 1;
				scheduleReconnect(baseDelay + jitter);
			}
		};

		connect();
		return () => {
			disposed = true;
			clearReconnectTimer();
			wsRef.current?.close();
			wsRef.current = null;
		};
	}, [channel, handleConnect, handleDisconnect, handleMessage]);
}
