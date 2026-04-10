/** @vitest-environment jsdom */

import type { Order } from "@sepetarasi/shared";
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderForm } from "../src/components/OrderForm";
import { api } from "../src/lib/api";

vi.mock("../src/lib/api", () => ({
	api: {
		createOrder: vi.fn(),
	},
}));

function buildOrder(overrides: Partial<Order> = {}): Order {
	return {
		id: "order-1",
		business_date: "2026-04-11",
		display_no: 7,
		status: "PREPARING",
		terminal_id: "KASA-1",
		customer_name: "Ayşe",
		order_type: "Paket",
		target_minutes: null,
		notes: "Az acılı",
		created_at: "2026-03-08T10:14:00.000Z",
		updated_at: "2026-03-08T10:14:00.000Z",
		ready_at: null,
		delivered_at: null,
		cancelled_at: null,
		items: [],
		...overrides,
	};
}

describe("OrderForm", () => {
	let container: HTMLDivElement;
	let root: Root;
	let printReceipt: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		printReceipt = vi.fn().mockResolvedValue({ ok: true });
		Object.defineProperty(window, "electronAPI", {
			value: {
				printReceipt,
			},
			configurable: true,
			writable: true,
		});

		await act(async () => {
			root.render(<OrderForm />);
		});
	});

	afterEach(async () => {
		await act(async () => {
			root.unmount();
		});
		container.remove();
		vi.clearAllMocks();
	});

	it("blocks submit when customer name is blank", async () => {
		await submitForm();

		expect(api.createOrder).not.toHaveBeenCalled();
		expect(container.textContent).toContain("Müşteri adı giriniz");
	});

	it("creates an order, prints receipt, and resets the form", async () => {
		vi.mocked(api.createOrder).mockResolvedValueOnce(buildOrder());

		await setInputValue(getCustomerInput(), "Ayşe");
		await setInputValue(getNotesTextarea(), "Az acılı");
		await submitForm();

		expect(api.createOrder).toHaveBeenCalledWith({
			customer_name: "Ayşe",
			order_type: "Paket",
			notes: "Az acılı",
			items: [],
		});
		expect(printReceipt).toHaveBeenCalledWith(
			expect.objectContaining({
				display_no: 7,
				customer_name: "Ayşe",
			}),
		);
		expect(getCustomerInput().value).toBe("");
		expect(getNotesTextarea().value).toBe("");
		expect(container.textContent).not.toContain("Tekrar Yazdır");
	});

	it("shows retry action when printing fails and retries the last receipt", async () => {
		vi.mocked(api.createOrder).mockResolvedValueOnce(
			buildOrder({ display_no: 15, customer_name: "Mehmet", notes: null }),
		);
		printReceipt
			.mockResolvedValueOnce({ ok: false, error: "Printer timeout" })
			.mockResolvedValueOnce({ ok: true });

		await setInputValue(getCustomerInput(), "Mehmet");
		await submitForm();

		expect(container.textContent).toContain("Sipariş #0015 oluşturuldu fakat fiş yazdırılamadı");
		expect(container.textContent).toContain("Tekrar Yazdır");
		expect(printReceipt).toHaveBeenCalledTimes(1);

		await act(async () => {
			getRetryButton().click();
		});

		expect(printReceipt).toHaveBeenCalledTimes(2);
		expect(container.textContent).not.toContain("Tekrar Yazdır");
	});

	function getCustomerInput() {
		const input = container.querySelector('input[placeholder="Müşteri adı"]');
		if (!(input instanceof HTMLInputElement)) {
			throw new Error("Customer input not found");
		}
		return input;
	}

	function getNotesTextarea() {
		const textarea = container.querySelector('textarea[placeholder="Not (opsiyonel)"]');
		if (!(textarea instanceof HTMLTextAreaElement)) {
			throw new Error("Notes textarea not found");
		}
		return textarea;
	}

	function getRetryButton() {
		const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
			candidate.textContent?.includes("Tekrar Yazdır"),
		);
		if (!(button instanceof HTMLButtonElement)) {
			throw new Error("Retry button not found");
		}
		return button;
	}

	async function setInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
		await act(async () => {
			const prototype =
				element instanceof HTMLInputElement
					? HTMLInputElement.prototype
					: HTMLTextAreaElement.prototype;
			const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
			valueSetter?.call(element, value);
			element.dispatchEvent(new Event("input", { bubbles: true }));
			element.dispatchEvent(new Event("change", { bubbles: true }));
		});
	}

	async function submitForm() {
		const form = container.querySelector("form");
		if (!(form instanceof HTMLFormElement)) {
			throw new Error("Form not found");
		}
		await act(async () => {
			form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
		});
	}
});
