/** @vitest-environment jsdom */

import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWebSocket } from "../src/hooks/useWebSocket";
import { api } from "../src/lib/api";
import { useOrderStore } from "../src/stores/orderStore";
import { CustomerDisplay } from "../src/views/display/CustomerDisplay";

vi.mock("../src/hooks/useWebSocket", () => ({
	useWebSocket: vi.fn(),
}));

vi.mock("../src/lib/api", () => ({
	api: {
		listOrders: vi.fn(),
		getStats: vi.fn(),
		getPublicSettings: vi.fn(),
	},
}));

describe("CustomerDisplay boot behavior", () => {
	let root: Root;
	let rootElement: HTMLDivElement;

	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		document.documentElement.setAttribute("data-app-shell", "booting");
		document.body.innerHTML = '<div id="app-boot" data-state="visible"></div><div id="root"></div>';
		rootElement = document.getElementById("root") as HTMLDivElement;
		root = createRoot(rootElement);

		useOrderStore.setState({
			orders: new Map(),
			stats: null,
			connected: false,
			loading: false,
			hasConnectedOnce: false,
			isHydrating: false,
			lastReconnectedAt: 0,
			lastSyncedAt: 0,
			nowPlaying: null,
		});

		vi.mocked(useWebSocket).mockReturnValue({ current: null });
		vi.mocked(api.listOrders).mockResolvedValue([]);
		vi.mocked(api.getPublicSettings).mockResolvedValue({});
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(async () => {
		await act(async () => {
			root.unmount();
		});
		vi.restoreAllMocks();
		document.body.innerHTML = "";
	});

	it.each(["/display", "/display.html?layout=split&max=4"])(
		"disables the boot overlay immediately on %s",
		async (route) => {
			await act(async () => {
				root.render(
					<MemoryRouter initialEntries={[route]}>
						<CustomerDisplay />
					</MemoryRouter>,
				);
			});

			expect(document.documentElement.getAttribute("data-app-shell")).toBe("ready");
			expect(document.getElementById("app-boot")).toBeNull();
		},
	);
});
