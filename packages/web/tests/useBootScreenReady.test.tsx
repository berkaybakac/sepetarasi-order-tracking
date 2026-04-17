/** @vitest-environment jsdom */

import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetBootScreenForTests, useBootScreenReady } from "../src/hooks/useBootScreenReady";

function TestHarness({ ready }: { ready: boolean }) {
	useBootScreenReady(ready, {
		minVisibleMs: 650,
		maxVisibleMs: 2600,
	});

	return <div>Boot harness</div>;
}

describe("useBootScreenReady", () => {
	let root: Root;
	let rootElement: HTMLDivElement;

	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		vi.useFakeTimers();
		document.documentElement.setAttribute("data-app-shell", "booting");
		document.body.innerHTML = '<div id="app-boot" data-state="visible"></div><div id="root"></div>';

		rootElement = document.getElementById("root") as HTMLDivElement;
		root = createRoot(rootElement);

		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			return window.setTimeout(() => callback(performance.now()), 0);
		});

		resetBootScreenForTests();
	});

	afterEach(async () => {
		await act(async () => {
			root.unmount();
		});
		vi.useRealTimers();
		vi.restoreAllMocks();
		document.body.innerHTML = "";
	});

	it("keeps the splash visible until the minimum duration has elapsed", async () => {
		await act(async () => {
			root.render(<TestHarness ready={true} />);
		});

		await act(async () => {
			vi.advanceTimersByTime(649);
		});

		expect(document.documentElement.getAttribute("data-app-shell")).toBe("booting");
		expect(document.getElementById("app-boot")).not.toBeNull();

		await act(async () => {
			vi.advanceTimersByTime(1);
			vi.runAllTimers();
		});

		expect(document.documentElement.getAttribute("data-app-shell")).toBe("ready");
		expect(document.getElementById("app-boot")).toBeNull();
	});

	it("reveals the app after the fallback timeout when no ready signal arrives", async () => {
		await act(async () => {
			root.render(<TestHarness ready={false} />);
		});

		await act(async () => {
			vi.advanceTimersByTime(2599);
		});

		expect(document.documentElement.getAttribute("data-app-shell")).toBe("booting");
		expect(document.getElementById("app-boot")).not.toBeNull();

		await act(async () => {
			vi.advanceTimersByTime(1);
			vi.runAllTimers();
		});

		expect(document.documentElement.getAttribute("data-app-shell")).toBe("ready");
		expect(document.getElementById("app-boot")).toBeNull();
	});
});
