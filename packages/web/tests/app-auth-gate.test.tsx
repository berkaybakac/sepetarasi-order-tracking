/** @vitest-environment jsdom */

import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { useAuthStore } from "../src/stores/auth.store";

vi.mock("../src/lib/api", () => ({
	api: {
		authCheck: vi.fn(),
	},
	ApiError: class ApiError extends Error {
		recoverable = false;
		status?: number;
	},
}));

vi.mock("../src/views/admin/AdminView", () => ({
	AdminView: () => <div>admin-view</div>,
}));

vi.mock("../src/views/admin/LoginView", () => ({
	LoginView: () => <div>login-view</div>,
}));

vi.mock("../src/views/display/CustomerDisplay", () => ({
	CustomerDisplay: () => <div>display-view</div>,
}));

describe("App auth gate", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		window.history.pushState({}, "", "/admin/orders");
		localStorage.clear();
		useAuthStore.setState({
			isAdmin: true,
			login: useAuthStore.getState().login,
			logout: useAuthStore.getState().logout,
			setAuthStatus: useAuthStore.getState().setAuthStatus,
		});
	});

	afterEach(async () => {
		await act(async () => {
			root.unmount();
		});
		container.remove();
		vi.clearAllMocks();
		localStorage.clear();
	});

	it("renders the admin view immediately while auth verification is still pending", async () => {
		const { api } = await import("../src/lib/api");
		vi.mocked(api.authCheck).mockImplementation(() => new Promise(() => undefined));

		await act(async () => {
			root.render(<App />);
		});

		expect(container.textContent).toContain("admin-view");
		expect(container.textContent).not.toContain("login-view");
	});

	it("routes /display.html to the customer display without running the admin auth gate", async () => {
		const { api } = await import("../src/lib/api");
		window.history.pushState({}, "", "/display.html?layout=split&max=4");

		await act(async () => {
			root.render(<App />);
		});

		expect(container.textContent).toContain("display-view");
		expect(container.textContent).not.toContain("admin-view");
		expect(container.textContent).not.toContain("login-view");
		expect(api.authCheck).not.toHaveBeenCalled();
	});
});
