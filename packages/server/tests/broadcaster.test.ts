import { describe, it, expect, vi } from "vitest";
import { Broadcaster } from "../src/ws/broadcaster.js";
import { WS_CHANNELS } from "@sepetarasi/shared";

/** Minimal mock WebSocket */
function createMockSocket(readyState = 1 /* OPEN */) {
	const listeners: Record<string, Array<() => void>> = {};
	return {
		readyState,
		OPEN: 1 as const,
		send: vi.fn(),
		on(event: string, handler: () => void) {
			if (!listeners[event]) listeners[event] = [];
			listeners[event].push(handler);
		},
		/** Simulate disconnect */
		disconnect() {
			listeners["close"]?.forEach((h) => h());
		},
	};
}

describe("Broadcaster — reconnect", () => {
	it("should remove disconnected client and not send to it", () => {
		const broadcaster = new Broadcaster();
		const socket = createMockSocket();

		broadcaster.subscribe(WS_CHANNELS.ORDERS, socket as never);

		// Verify connected: message reaches client
		broadcaster.broadcast([WS_CHANNELS.ORDERS], "test:event", { n: 1 });
		expect(socket.send).toHaveBeenCalledTimes(1);

		// Simulate disconnect
		socket.disconnect();

		// Message after disconnect must NOT reach old socket
		broadcaster.broadcast([WS_CHANNELS.ORDERS], "test:event", { n: 2 });
		expect(socket.send).toHaveBeenCalledTimes(1); // still 1, no new call
	});

	it("should deliver messages to reconnected (new) socket", () => {
		const broadcaster = new Broadcaster();
		const socket1 = createMockSocket();
		const socket2 = createMockSocket();

		// First connection
		broadcaster.subscribe(WS_CHANNELS.ORDERS, socket1 as never);
		broadcaster.broadcast([WS_CHANNELS.ORDERS], "test:event", { n: 1 });
		expect(socket1.send).toHaveBeenCalledTimes(1);

		// Disconnect
		socket1.disconnect();

		// Reconnect with new socket
		broadcaster.subscribe(WS_CHANNELS.ORDERS, socket2 as never);
		broadcaster.broadcast([WS_CHANNELS.ORDERS], "test:event", { n: 2 });

		expect(socket1.send).toHaveBeenCalledTimes(1); // old: no new messages
		expect(socket2.send).toHaveBeenCalledTimes(1); // new: received message
	});

	it("should not send to CLOSED socket even if close event was not fired", () => {
		const broadcaster = new Broadcaster();
		const socket = createMockSocket(3 /* CLOSED */);

		broadcaster.subscribe(WS_CHANNELS.ORDERS, socket as never);
		broadcaster.broadcast([WS_CHANNELS.ORDERS], "test:event", {});

		expect(socket.send).not.toHaveBeenCalled();
	});

	it("should support multiple channels independently", () => {
		const broadcaster = new Broadcaster();
		const orderSocket = createMockSocket();
		const displaySocket = createMockSocket();

		broadcaster.subscribe(WS_CHANNELS.ORDERS, orderSocket as never);
		broadcaster.subscribe(WS_CHANNELS.DISPLAY, displaySocket as never);

		// Disconnect orders client
		orderSocket.disconnect();

		// Broadcast to both channels
		broadcaster.broadcast([WS_CHANNELS.ORDERS, WS_CHANNELS.DISPLAY], "test:event", {});

		expect(orderSocket.send).not.toHaveBeenCalled();
		expect(displaySocket.send).toHaveBeenCalledTimes(1);
	});
});
