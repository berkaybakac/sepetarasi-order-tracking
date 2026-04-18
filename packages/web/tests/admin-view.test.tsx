/** @vitest-environment jsdom */

import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminView } from "../src/views/admin/AdminView";

const renderLog = {
	orders: 0,
	stats: 0,
	audio: 0,
	display: 0,
	notes: 0,
};

vi.mock("../src/hooks/useBootScreenReady", () => ({
	useBootScreenReady: vi.fn(),
}));

vi.mock("../src/hooks/useWebSocket", () => ({
	useWebSocket: vi.fn(),
}));

vi.mock("../src/views/admin/AdminHeader", () => ({
	AdminHeader: () => <div>admin-header</div>,
}));

vi.mock("../src/stores/orderStore", () => ({
	useOrderStore: (selector: (state: Record<string, unknown>) => unknown) =>
		selector({
			hydrate: vi.fn().mockResolvedValue(true),
			applyWsEvent: vi.fn(),
			setConnected: vi.fn(),
			lastReconnectedAt: 0,
		}),
}));

vi.mock("../src/stores/settingsStore", () => ({
	useSettingsStore: (selector: (state: Record<string, unknown>) => unknown) =>
		selector({
			hydrate: vi.fn().mockResolvedValue(undefined),
		}),
}));

vi.mock("../src/stores/musicStore", () => ({
	useMusicStore: (selector: (state: Record<string, unknown>) => unknown) =>
		selector({
			setStatus: vi.fn(),
		}),
}));

vi.mock("../src/views/admin/tabs/OrdersTab", () => ({
	OrdersTab: () => {
		renderLog.orders += 1;
		return <div>orders-tab</div>;
	},
}));

vi.mock("../src/views/admin/tabs/StatsTab", () => ({
	StatsTab: () => {
		renderLog.stats += 1;
		return <div>stats-tab</div>;
	},
}));

vi.mock("../src/views/admin/tabs/AudioTab", () => ({
	AudioTab: () => {
		renderLog.audio += 1;
		return <div>audio-tab</div>;
	},
}));

vi.mock("../src/views/admin/tabs/DisplayTab", () => ({
	DisplayTab: () => {
		renderLog.display += 1;
		return <div>display-tab</div>;
	},
}));

vi.mock("../src/views/admin/tabs/NotePresetsTab", () => ({
	NotePresetsTab: () => {
		renderLog.notes += 1;
		return <div>notes-tab</div>;
	},
}));

describe("AdminView", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		window.history.pushState({}, "", "/admin/orders");
		vi.useFakeTimers();
		renderLog.orders = 0;
		renderLog.stats = 0;
		renderLog.audio = 0;
		renderLog.display = 0;
		renderLog.notes = 0;
	});

	afterEach(async () => {
		await act(async () => {
			root.unmount();
		});
		container.remove();
		vi.useRealTimers();
	});

	it("does not eagerly mount hidden admin tabs after the initial hydrate", async () => {
		await act(async () => {
			root.render(
				<BrowserRouter>
					<Routes>
						<Route path="/admin/*" element={<AdminView />} />
					</Routes>
				</BrowserRouter>,
			);
		});

		expect(renderLog.orders).toBeGreaterThan(0);
		expect(renderLog.stats).toBe(0);
		expect(renderLog.audio).toBe(0);
		expect(renderLog.display).toBe(0);
		expect(renderLog.notes).toBe(0);

		await act(async () => {
			await vi.runAllTimersAsync();
			await Promise.resolve();
		});

		expect(renderLog.orders).toBeGreaterThan(0);
		expect(renderLog.stats).toBe(0);
		expect(renderLog.audio).toBe(0);
		expect(renderLog.display).toBe(0);
		expect(renderLog.notes).toBe(0);
		expect(container.textContent).toContain("orders-tab");
		expect(container.textContent).not.toContain("stats-tab");
	});
});
