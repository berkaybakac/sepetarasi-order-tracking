/** @vitest-environment jsdom */

import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KasaApp } from "../src/App";
import { ApiError, api } from "../src/lib/api";
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
		verifyAdminPassword: vi.fn(),
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

function setConnectionState(connected: boolean) {
	useOrderStore.setState({
		orders: new Map(),
		connected,
		loading: false,
		error: null,
		hasConnectedOnce: connected,
		isHydrating: false,
		lastReconnectedAt: 0,
	});
}

function getStatusButton(container: HTMLDivElement): HTMLButtonElement {
	const button = Array.from(container.querySelectorAll("button")).find((node) =>
		node.textContent?.match(/Bağlı|Bağlantı kesildi/),
	);
	if (!(button instanceof HTMLButtonElement)) {
		throw new Error("Status button not found");
	}
	return button;
}

async function click(element: HTMLElement) {
	await act(async () => {
		element.click();
	});
}

async function changeInputValue(input: HTMLInputElement, value: string) {
	const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
	if (!setter) {
		throw new Error("HTMLInputElement value setter not found");
	}

	await act(async () => {
		setter.call(input, value);
		input.dispatchEvent(new Event("input", { bubbles: true }));
	});
}

async function submit(form: HTMLFormElement) {
	await act(async () => {
		form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
	});
}

describe("Kasa App header", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		setConnectionState(false);

		vi.mocked(api.listOrders).mockResolvedValue([]);
		vi.mocked(api.getPublicSettings).mockResolvedValue({});
		vi.mocked(api.verifyAdminPassword).mockResolvedValue(null);
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

	it("prompts for admin password before opening config when connected", async () => {
		setConnectionState(true);
		const onReconfigure = vi.fn();

		await act(async () => {
			root.render(<KasaApp onReconfigure={onReconfigure} />);
		});

		await click(getStatusButton(container));

		expect(onReconfigure).not.toHaveBeenCalled();
		expect(container.textContent).toContain("Yönetici Şifresi");
		expect(vi.mocked(api.verifyAdminPassword)).not.toHaveBeenCalled();
	});

	it("keeps the unlock input easy to focus while toggling password visibility", async () => {
		setConnectionState(true);

		await act(async () => {
			root.render(<KasaApp onReconfigure={() => undefined} />);
		});

		await click(getStatusButton(container));

		const passwordInput = container.querySelector("#admin-unlock-password");
		if (!(passwordInput instanceof HTMLInputElement)) {
			throw new Error("Unlock password input not found");
		}
		const passwordShell = passwordInput.parentElement;
		if (!(passwordShell instanceof HTMLDivElement)) {
			throw new Error("Unlock password shell not found");
		}
		const toggleButton = container.querySelector('button[aria-label="Parolayı göster"]');
		if (!(toggleButton instanceof HTMLButtonElement)) {
			throw new Error("Unlock toggle button not found");
		}

		await click(passwordShell);

		expect(document.activeElement).toBe(passwordInput);
		expect(passwordInput.type).toBe("password");

		await act(async () => {
			toggleButton.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));
			toggleButton.click();
		});

		expect(passwordInput.type).toBe("text");
		expect(document.activeElement).toBe(passwordInput);
	});

	it("keeps the cashier on the current screen when admin password is wrong", async () => {
		setConnectionState(true);
		const onReconfigure = vi.fn();
		vi.mocked(api.verifyAdminPassword).mockRejectedValue(
			new ApiError("UNAUTHORIZED", "Invalid password", 401),
		);

		await act(async () => {
			root.render(<KasaApp onReconfigure={onReconfigure} />);
		});

		await click(getStatusButton(container));

		const passwordInput = container.querySelector("#admin-unlock-password");
		if (!(passwordInput instanceof HTMLInputElement)) {
			throw new Error("Unlock password input not found");
		}

		await changeInputValue(passwordInput, "wrong-password");

		const form = passwordInput.closest("form");
		if (!(form instanceof HTMLFormElement)) {
			throw new Error("Unlock form not found");
		}

		await submit(form);

		expect(onReconfigure).not.toHaveBeenCalled();
		expect(vi.mocked(api.verifyAdminPassword)).toHaveBeenCalledWith("wrong-password");
		expect(container.textContent).toContain("Yönetici şifresi hatalı.");
		expect(container.textContent).toContain("Yönetici Şifresi");
	});

	it("opens config after a correct admin password", async () => {
		setConnectionState(true);
		const onReconfigure = vi.fn();

		await act(async () => {
			root.render(<KasaApp onReconfigure={onReconfigure} />);
		});

		await click(getStatusButton(container));

		const passwordInput = container.querySelector("#admin-unlock-password");
		if (!(passwordInput instanceof HTMLInputElement)) {
			throw new Error("Unlock password input not found");
		}

		await changeInputValue(passwordInput, "admin123");

		const form = passwordInput.closest("form");
		if (!(form instanceof HTMLFormElement)) {
			throw new Error("Unlock form not found");
		}

		await submit(form);

		expect(vi.mocked(api.verifyAdminPassword)).toHaveBeenCalledWith("admin123");
		expect(onReconfigure).toHaveBeenCalledTimes(1);
	});

	it("opens config directly when the connection is already down", async () => {
		setConnectionState(false);
		const onReconfigure = vi.fn();

		await act(async () => {
			root.render(<KasaApp onReconfigure={onReconfigure} />);
		});

		await click(getStatusButton(container));

		expect(onReconfigure).toHaveBeenCalledTimes(1);
		expect(vi.mocked(api.verifyAdminPassword)).not.toHaveBeenCalled();
		expect(container.textContent).not.toContain("Yönetici Şifresi");
	});
});
