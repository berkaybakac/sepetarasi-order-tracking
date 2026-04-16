/** @vitest-environment jsdom */

import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KasaApp } from "../src/App";
import { api } from "../src/lib/api";
import { useOrderStore } from "../src/stores/orderStore";

vi.mock("../src/hooks/useWebSocket", () => ({
	useWebSocket: vi.fn(),
}));

vi.mock("../src/lib/api", () => ({
	api: {
		listOrders: vi.fn(),
		getPublicSettings: vi.fn(),
		createOrder: vi.fn(),
		changeStatus: vi.fn(),
	},
	setBaseUrl: vi.fn(),
	setCashierToken: vi.fn(),
	setTerminalId: vi.fn(),
	ApiError: class ApiError extends Error {
		code: string;
		statusCode: number;

		constructor(code: string, message: string, statusCode: number) {
			super(message);
			this.name = "ApiError";
			this.code = code;
			this.statusCode = statusCode;
		}
	},
}));

describe("Kasa App header", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		useOrderStore.setState({
			orders: new Map(),
			connected: false,
			loading: false,
			error: null,
			hasConnectedOnce: false,
			isHydrating: false,
			lastReconnectedAt: 0,
		});

		vi.mocked(api.listOrders).mockResolvedValue([]);
		vi.mocked(api.getPublicSettings).mockResolvedValue({});
	});

	afterEach(async () => {
		await act(async () => {
			root.unmount();
		});
		container.remove();
		vi.clearAllMocks();
	});

	it("does not render stats chips in header", async () => {
		await act(async () => {
			root.render(<KasaApp onReconfigure={() => undefined} />);
		});

		expect(container.textContent).not.toMatch(/\b\d+\s*sipariş\b/i);
		expect(container.textContent).not.toMatch(/\bort\.\s*\d+/i);
	});
});
