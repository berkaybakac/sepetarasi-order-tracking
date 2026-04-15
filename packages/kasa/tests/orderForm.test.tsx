/** @vitest-environment jsdom */

import { type Order, OrderStatus } from "@sepetarasi/shared";
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderForm } from "../src/components/OrderForm";
import { api } from "../src/lib/api";

vi.mock("../src/lib/api", () => ({
	api: {
		createOrder: vi.fn(),
		getPublicSettings: vi.fn().mockResolvedValue({}),
	},
}));

function buildOrder(overrides: Partial<Order> = {}): Order {
	return {
		id: "order-1",
		business_date: "2026-04-11",
		display_no: 7,
		status: OrderStatus.PREPARING,
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
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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

	it("sends Masada order_type when toggled", async () => {
		vi.mocked(api.createOrder).mockResolvedValueOnce(buildOrder({ order_type: "Masada" }));

		await setInputValue(getCustomerInput(), "Ali");
		await act(async () => {
			getMasadaButton().click();
		});
		await submitForm();

		expect(api.createOrder).toHaveBeenCalledWith(expect.objectContaining({ order_type: "Masada" }));
	});

	it("clears the retry button after a successful subsequent print", async () => {
		// First order: print fails → retry button visible
		vi.mocked(api.createOrder).mockResolvedValueOnce(buildOrder({ display_no: 10 }));
		printReceipt.mockResolvedValueOnce({ ok: false, error: "Printer timeout" });

		await setInputValue(getCustomerInput(), "Zeynep");
		await submitForm();
		expect(container.textContent).toContain("Tekrar Yazdır");

		// Second order: print succeeds → retry button must disappear
		vi.mocked(api.createOrder).mockResolvedValueOnce(buildOrder({ display_no: 11 }));
		printReceipt.mockResolvedValueOnce({ ok: true });

		await setInputValue(getCustomerInput(), "Fatma");
		await submitForm();
		expect(container.textContent).not.toContain("Tekrar Yazdır");
	});

	it("renders preset chips from public settings and appends to notes on click", async () => {
		// Re-mount with presets returned from server
		await act(async () => {
			root.unmount();
		});
		vi.mocked(api.getPublicSettings).mockResolvedValueOnce({
			note_presets: JSON.stringify(["Ketçap bol", "Acılı"]),
		});
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		await act(async () => {
			root.render(<OrderForm />);
		});
		// Allow getPublicSettings promise to resolve
		await act(async () => {
			await Promise.resolve();
		});

		const chip = Array.from(container.querySelectorAll("button")).find((b) =>
			b.textContent?.includes("Ketçap bol"),
		);
		if (!(chip instanceof HTMLButtonElement)) throw new Error("Preset chip not found");

		await act(async () => {
			chip.click();
		});
		expect(getNotesTextarea().value).toBe("Ketçap bol");

		const chip2 = Array.from(container.querySelectorAll("button")).find((b) =>
			b.textContent?.includes("Acılı"),
		) as HTMLButtonElement;
		await act(async () => {
			chip2.click();
		});
		expect(getNotesTextarea().value).toBe("Ketçap bol, Acılı");
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
		const input = container.querySelector("#customer-name");
		if (!(input instanceof HTMLInputElement)) {
			throw new Error("Customer input not found");
		}
		return input;
	}

	function getNotesTextarea() {
		const textarea = container.querySelector("#order-notes");
		if (!(textarea instanceof HTMLTextAreaElement)) {
			throw new Error("Notes textarea not found");
		}
		return textarea;
	}

	function getMasadaButton() {
		const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
			candidate.textContent?.includes("Masada"),
		);
		if (!(button instanceof HTMLButtonElement)) {
			throw new Error("Masada button not found");
		}
		return button;
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
