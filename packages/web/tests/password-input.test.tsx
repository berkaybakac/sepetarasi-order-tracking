/** @vitest-environment jsdom */

import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PasswordInput } from "../src/views/admin/ui/primitives";

describe("PasswordInput", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
	});

	afterEach(async () => {
		await act(async () => {
			root.unmount();
		});
		container.remove();
	});

	it("focuses the input when the field shell receives pointer down", async () => {
		await act(async () => {
			root.render(<PasswordInput id="admin-password" defaultValue="admin123" />);
		});

		const input = container.querySelector("#admin-password");
		if (!(input instanceof HTMLInputElement)) {
			throw new Error("Password input not found");
		}
		const shell = input.parentElement;
		if (!(shell instanceof HTMLDivElement)) {
			throw new Error("Password shell not found");
		}

		await act(async () => {
			shell.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
		});

		expect(document.activeElement).toBe(input);
	});

	it("focuses the input on pointer down so touch interactions stay responsive", async () => {
		await act(async () => {
			root.render(<PasswordInput id="admin-password" defaultValue="admin123" />);
		});

		const input = container.querySelector("#admin-password");
		if (!(input instanceof HTMLInputElement)) {
			throw new Error("Password input not found");
		}
		const shell = input.parentElement;
		if (!(shell instanceof HTMLDivElement)) {
			throw new Error("Password shell not found");
		}

		await act(async () => {
			shell.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));
		});

		expect(document.activeElement).toBe(input);
	});

	it("keeps focus on the input while toggling password visibility", async () => {
		await act(async () => {
			root.render(<PasswordInput id="admin-password" defaultValue="admin123" />);
		});

		const input = container.querySelector("#admin-password");
		if (!(input instanceof HTMLInputElement)) {
			throw new Error("Password input not found");
		}
		const toggleButton = container.querySelector('button[aria-label="Parolayı göster"]');
		if (!(toggleButton instanceof HTMLButtonElement)) {
			throw new Error("Visibility toggle button not found");
		}

		await act(async () => {
			input.focus();
		});
		expect(document.activeElement).toBe(input);
		expect(input.type).toBe("password");

		await act(async () => {
			toggleButton.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));
			toggleButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		});

		expect(input.type).toBe("text");
		expect(input.value).toBe("admin123");
		expect(document.activeElement).toBe(input);
	});
});
