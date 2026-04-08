import type { WsMessage } from "@sepetarasi/shared";
import { useCallback, useEffect, useRef } from "react";

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
		const protocol = location.protocol === "https:" ? "wss:" : "ws:";
		const wsUrl = `${protocol}//${location.host}/ws?channel=${channel}`;

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
}
