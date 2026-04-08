import type { WsMessage } from "@sepetarasi/shared";
import type { WebSocket } from "ws";

export class Broadcaster {
	private channels = new Map<string, Set<WebSocket>>();
	private allClients = new Set<WebSocket>();
	private closeHandlerInstalled = new WeakSet<WebSocket>();

	subscribe(channel: string, ws: WebSocket) {
		if (!this.channels.has(channel)) {
			this.channels.set(channel, new Set());
		}
		this.channels.get(channel)?.add(ws);
		this.allClients.add(ws);

		// Install exactly one close handler per socket, even if it subscribes to multiple channels.
		if (!this.closeHandlerInstalled.has(ws)) {
			this.closeHandlerInstalled.add(ws);
			ws.on("close", () => {
				for (const clients of this.channels.values()) {
					clients.delete(ws);
				}
				this.allClients.delete(ws);
			});
		}
	}

	/** Broadcast a message to all clients in the given channels */
	broadcast(channels: string[], event: string, data: unknown) {
		const message: WsMessage = {
			event,
			data,
			timestamp: new Date().toISOString(),
		};
		const payload = JSON.stringify(message);

		for (const channel of channels) {
			const clients = this.channels.get(channel);
			if (!clients) continue;
			for (const ws of clients) {
				if (ws.readyState === ws.OPEN) {
					ws.send(payload);
				}
			}
		}
	}

	/** Get count of connected clients per channel (for debugging) */
	getStats() {
		const stats: Record<string, number> = {};
		for (const [channel, clients] of this.channels) {
			stats[channel] = clients.size;
		}
		return stats;
	}

	/** Get all unique connected clients across all channels */
	getAllClients(): ReadonlySet<WebSocket> {
		return this.allClients;
	}
}
