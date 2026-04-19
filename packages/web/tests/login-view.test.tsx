/** @vitest-environment jsdom */

import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../src/stores/auth.store";
import { LoginView } from "../src/views/admin/LoginView";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
	const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
	return {
		...actual,
		useNavigate: () => navigateMock,
	};
});

vi.mock("../src/hooks/useBootScreenReady", () => ({
	useBootScreenReady: vi.fn(),
}));

vi.mock("../src/lib/api", async () => {
	const actual = await vi.importActual<typeof import("../src/lib/api")>("../src/lib/api");
	return {
		...actual,
		api: {
			authLogin: vi.fn(),
		},
	};
});

function getPasswordInput(container: HTMLDivElement) {
	const input = container.querySelector("#admin-password");
	if (!(input instanceof HTMLInputElement)) {
		throw new Error("Password input not found");
	}
	return input;
}

function getSubmitButton(container: HTMLDivElement) {
	const button = Array.from(container.querySelectorAll("button")).find((node) =>
		node.textContent?.includes("Giriş Yap"),
	);

	if (!(button instanceof HTMLButtonElement)) {
		throw new Error("Submit button not found");
	}

	return button;
}

async function setPassword(input: HTMLInputElement, value: string) {
	await act(async () => {
		const valueSetter = Object.getOwnPropertyDescriptor(
			window.HTMLInputElement.prototype,
			"value",
		)?.set;
		valueSetter?.call(input, value);
		input.dispatchEvent(new Event("input", { bubbles: true }));
	});
}

async function submitLogin(container: HTMLDivElement) {
	const form = container.querySelector("form");
	if (!(form instanceof HTMLFormElement)) {
		throw new Error("Login form not found");
	}

	await act(async () => {
		form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
		await Promise.resolve();
	});
}

async function flushEffects() {
	await act(async () => {
		await Promise.resolve();
		await Promise.resolve();
	});
}

describe("LoginView", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		localStorage.clear();
		navigateMock.mockReset();
		useAuthStore.setState({
			isAdmin: false,
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

	it("renders the auth-first form without template marketing copy", async () => {
		await act(async () => {
			root.render(<LoginView />);
		});

		expect(container.textContent).toContain("Giriş yapın");
		expect(container.textContent).toContain("Admin Parolası");
		expect(container.textContent).not.toContain("Premium dark admin");
		expect(container.textContent).not.toContain("Tutarlı UX");
		expect(container.textContent).not.toContain("empty state");
		expect(document.activeElement).toBe(getPasswordInput(container));
	});

	it("keeps submit disabled until a password is entered", async () => {
		await act(async () => {
			root.render(<LoginView />);
		});

		const input = getPasswordInput(container);
		const button = getSubmitButton(container);

		expect(button.disabled).toBe(true);

		await setPassword(input, "sepetarasi");

		expect(button.disabled).toBe(false);
	});

	it("shows the loading label while the login request is in flight", async () => {
		const { api } = await import("../src/lib/api");
		let resolveRequest: ((value: null) => void) | null = null;
		vi.mocked(api.authLogin).mockImplementation(
			() =>
				new Promise<null>((resolve) => {
					resolveRequest = resolve;
				}),
		);

		await act(async () => {
			root.render(<LoginView />);
		});

		await setPassword(getPasswordInput(container), "sepetarasi");
		await submitLogin(container);

		expect(container.textContent).toContain("Giriş Yapılıyor...");
		expect(getSubmitButton(container).disabled).toBe(true);

		resolveRequest?.(null);
		await flushEffects();
	});

	it("shows the error message when login fails", async () => {
		const { api } = await import("../src/lib/api");
		vi.mocked(api.authLogin).mockRejectedValue(new Error("Parola doğrulanamadı."));

		await act(async () => {
			root.render(<LoginView />);
		});

		await setPassword(getPasswordInput(container), "yanlis-parola");
		await submitLogin(container);
		await flushEffects();

		expect(container.textContent).toContain("Parola doğrulanamadı.");
		expect(useAuthStore.getState().isAdmin).toBe(false);
		expect(navigateMock).not.toHaveBeenCalled();
	});

	it("masks raw English login errors with a Turkish fallback", async () => {
		const { api } = await import("../src/lib/api");
		vi.mocked(api.authLogin).mockRejectedValue(new Error("Invalid password"));

		await act(async () => {
			root.render(<LoginView />);
		});

		await setPassword(getPasswordInput(container), "yanlis-parola");
		await submitLogin(container);
		await flushEffects();

		expect(container.textContent).toContain("Giriş başarısız. Parolanızı kontrol edin.");
		expect(container.textContent).not.toContain("Invalid password");
		expect(useAuthStore.getState().isAdmin).toBe(false);
		expect(navigateMock).not.toHaveBeenCalled();
	});

	it("updates auth state and navigates to the admin route after a successful login", async () => {
		const { api } = await import("../src/lib/api");
		vi.mocked(api.authLogin).mockResolvedValue(null);

		await act(async () => {
			root.render(<LoginView />);
		});

		await setPassword(getPasswordInput(container), "dogru-parola");
		await submitLogin(container);
		await flushEffects();

		expect(api.authLogin).toHaveBeenCalledWith("dogru-parola");
		expect(useAuthStore.getState().isAdmin).toBe(true);
		expect(navigateMock).toHaveBeenCalledWith("/admin");
	});
});
