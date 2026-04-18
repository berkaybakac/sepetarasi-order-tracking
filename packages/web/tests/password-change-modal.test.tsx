/** @vitest-environment jsdom */

import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "../src/lib/api";
import { PasswordChangeModal } from "../src/views/admin/header/PasswordChangeModal";

vi.mock("../src/lib/api", () => ({
	api: {
		authChangePassword: vi.fn(),
	},
	ApiError: class ApiError extends Error {
		code?: string;
		status?: number;
		recoverable: boolean;

		constructor(
			message: string,
			options: { code?: string; status?: number; recoverable?: boolean } = {},
		) {
			super(message);
			this.name = "ApiError";
			this.code = options.code;
			this.status = options.status;
			this.recoverable = options.recoverable ?? false;
		}
	},
}));

function getInput(container: HTMLDivElement, id: string) {
	const input = container.querySelector(`#${id}`);
	if (!(input instanceof HTMLInputElement)) {
		throw new Error(`${id} input not found`);
	}
	return input;
}

async function setInputValue(input: HTMLInputElement, value: string) {
	const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
	if (!setter) {
		throw new Error("HTMLInputElement value setter not found");
	}

	await act(async () => {
		setter.call(input, value);
		input.dispatchEvent(new Event("input", { bubbles: true }));
	});
}

async function submitForm(container: HTMLDivElement) {
	const form = container.querySelector("form");
	if (!(form instanceof HTMLFormElement)) {
		throw new Error("Password change form not found");
	}

	await act(async () => {
		form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
		await Promise.resolve();
	});
}

describe("PasswordChangeModal", () => {
	let container: HTMLDivElement;
	let root: Root;
	let onClose: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		onClose = vi.fn();

		vi.spyOn(window, "requestAnimationFrame").mockImplementation(
			(callback: FrameRequestCallback) => {
				callback(0);
				return 1;
			},
		);
		vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
		vi.mocked(api.authChangePassword).mockResolvedValue(null);
	});

	afterEach(async () => {
		await act(async () => {
			root.unmount();
		});
		container.remove();
		vi.restoreAllMocks();
	});

	it("focuses the current password field and keeps inside clicks from closing the modal", async () => {
		await act(async () => {
			root.render(<PasswordChangeModal open onClose={onClose} />);
		});

		const currentPassword = getInput(container, "current-password");
		const dialog = container.querySelector("dialog");
		if (!(dialog instanceof HTMLDialogElement)) {
			throw new Error("Dialog panel not found");
		}

		expect(document.activeElement).toBe(currentPassword);

		await act(async () => {
			dialog.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
		});

		expect(onClose).not.toHaveBeenCalled();

		await setInputValue(currentPassword, "admin123");
		expect(currentPassword.value).toBe("admin123");
	});

	it("closes when the backdrop is pressed", async () => {
		await act(async () => {
			root.render(<PasswordChangeModal open onClose={onClose} />);
		});

		const dialog = container.querySelector("dialog");
		if (!(dialog instanceof HTMLDialogElement)) {
			throw new Error("Dialog panel not found");
		}
		const backdrop = dialog.parentElement;
		if (!(backdrop instanceof HTMLDivElement)) {
			throw new Error("Dialog backdrop not found");
		}

		await act(async () => {
			backdrop.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
		});

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("shows a localized current-password error and clears it after editing", async () => {
		vi.mocked(api.authChangePassword).mockRejectedValue(
			new ApiError("Current password is wrong", {
				code: "INVALID_CURRENT_PASSWORD",
				status: 400,
			}),
		);

		await act(async () => {
			root.render(<PasswordChangeModal open onClose={onClose} />);
		});

		await setInputValue(getInput(container, "current-password"), "wrong-password");
		await setInputValue(getInput(container, "new-password"), "new-password-1");
		await setInputValue(getInput(container, "confirm-password"), "new-password-1");
		await submitForm(container);

		expect(container.textContent).toContain("Mevcut parola hatalı.");

		await setInputValue(getInput(container, "current-password"), "admin123");

		expect(container.textContent).not.toContain("Mevcut parola hatalı.");
	});

	it("blocks reusing the current password before sending the request", async () => {
		await act(async () => {
			root.render(<PasswordChangeModal open onClose={onClose} />);
		});

		await setInputValue(getInput(container, "current-password"), "admin123");
		await setInputValue(getInput(container, "new-password"), "admin123");
		await setInputValue(getInput(container, "confirm-password"), "admin123");
		await submitForm(container);

		expect(vi.mocked(api.authChangePassword)).not.toHaveBeenCalled();
		expect(container.textContent).toContain("Yeni parola mevcut parola ile aynı olamaz.");
	});
});
