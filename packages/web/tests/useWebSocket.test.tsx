/** @vitest-environment jsdom */

import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWebSocket } from "../src/hooks/useWebSocket";

class MockWebSocket {
	static instances: MockWebSocket[] = [];

	url: string;
	onopen: (() => void) | null = null;
	onmessage: ((event: MessageEvent<string>) => void) | null = null;
	onclose: (() => void) | null = null;
	onerror: (() => void) | null = null;
	close = vi.fn(() => {
		this.onclose?.();
	});

	constructor(url: string) {
		this.url = url;
		MockWebSocket.instances.push(this);
	}

	emitClose() {
		this.onclose?.();
	}
}

function TestHarness() {
	useWebSocket({
		channel: "orders",
		onMessage: () => undefined,
		onConnect: () => undefined,
		onDisconnect: () => undefined,
	});

	return null;
}

describe("useWebSocket", () => {
	let container: HTMLDivElement;
	let root: Root;
	let originalWebSocket: typeof globalThis.WebSocket;

	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		MockWebSocket.instances = [];
		originalWebSocket = globalThis.WebSocket;
		vi.useFakeTimers();
		vi.spyOn(Math, "random").mockReturnValue(0);
		globalThis.WebSocket = MockWebSocket as unknown as typeof globalThis.WebSocket;
	});

	afterEach(async () => {
		await act(async () => {
			root.unmount();
		});
		container.remove();
		globalThis.WebSocket = originalWebSocket;
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it("does not reconnect after the hook unmounts", async () => {
		await act(async () => {
			root.render(<TestHarness />);
		});

		expect(MockWebSocket.instances).toHaveLength(1);

		await act(async () => {
			root.render(null);
		});

		expect(MockWebSocket.instances[0]?.close).toHaveBeenCalledTimes(1);

		await act(async () => {
			vi.advanceTimersByTime(30_000);
		});

		expect(MockWebSocket.instances).toHaveLength(1);
	});

	it("reconnects once after a real socket close while still mounted", async () => {
		await act(async () => {
			root.render(<TestHarness />);
		});

		expect(MockWebSocket.instances).toHaveLength(1);

		await act(async () => {
			MockWebSocket.instances[0]?.emitClose();
		});

		expect(MockWebSocket.instances).toHaveLength(1);

		await act(async () => {
			vi.advanceTimersByTime(1_000);
		});

		expect(MockWebSocket.instances).toHaveLength(2);
	});
});
