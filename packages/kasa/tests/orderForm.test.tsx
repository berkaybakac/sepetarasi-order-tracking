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
		expect(getSelectedPresetPreview().textContent).toContain("Seçilen hazır not");
		expect(getSelectedPresetPreview().textContent).toContain("Ketçap bol");

		const chip2 = Array.from(container.querySelectorAll("button")).find((b) =>
			b.textContent?.includes("Acılı"),
		) as HTMLButtonElement;
		await act(async () => {
			chip2.click();
		});
		expect(getNotesTextarea().value).toBe("Ketçap bol, Acılı");
		expect(getSelectedPresetPreview().textContent).toContain("Acılı");
	});

	it("keeps the scroll area and footer separated for the sticky layout", () => {
		const form = getForm();
		const scrollArea = getScrollArea();
		const footer = getFooter();

		expect(form.className).toContain("h-full");
		expect(form.className).toContain("min-h-0");
		expect(form.className).toContain("flex-col");
		expect(scrollArea.className).toContain("overflow-y-auto");
		expect(scrollArea.className).toContain("min-h-0");
		expect(footer.className).toContain("mt-auto");
		expect(footer.className).toContain("shrink-0");
	});

	it("disables spellcheck for touch-friendly inputs", () => {
		expect(getCustomerInput().getAttribute("spellcheck")).toBe("false");
		expect(getNotesTextarea().getAttribute("spellcheck")).toBe("false");
	});

	it("renders long preset chips with truncation classes and no title", async () => {
		const longPreset = "Mayonez bol olsun mayonez bol olsun mayonez bol olsun";

		await remountWithPresets([longPreset]);

		const chip = getPresetButton(longPreset);

		expect(chip.getAttribute("title")).toBeNull();
		expect(chip.className).toContain("overflow-hidden");
		expect(chip.className).toContain("text-ellipsis");
		expect(chip.className).toContain("whitespace-nowrap");
		expect(getPresetsContainer().className).toContain("max-h-[clamp(10rem,32vh,18rem)]");
		expect(getPresetsContainer().className).toContain("overflow-y-auto");
	});

	it("clears the preset preview after a successful submit", async () => {
		await remountWithPresets(["Ketçap bol"]);
		vi.mocked(api.createOrder).mockResolvedValueOnce(buildOrder({ notes: "Ketçap bol" }));

		await act(async () => {
			getPresetButton("Ketçap bol").click();
		});
		await setInputValue(getCustomerInput(), "Ayşe");
		await submitForm();

		expect(container.querySelector('[data-testid="selected-preset-preview"]')).toBeNull();
	});

	it("shows a fade when the presets overflow and hides it at the end of the scroll", async () => {
		await remountWithPresets(["a", "b", "c"]);

		const presetsContainer = getPresetsContainer();
		setScrollMetrics(presetsContainer, { clientHeight: 120, scrollHeight: 260, scrollTop: 0 });
		await act(async () => {
			presetsContainer.dispatchEvent(new Event("scroll", { bubbles: true }));
		});
		expect(getPresetsFade()).not.toBeNull();

		setScrollMetrics(presetsContainer, { clientHeight: 120, scrollHeight: 260, scrollTop: 140 });
		await act(async () => {
			presetsContainer.dispatchEvent(new Event("scroll", { bubbles: true }));
		});
		expect(getPresetsFade()).toBeNull();
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

		expect(container.textContent).toContain("Sipariş #0015 oluşturuldu. Fiş yazdırılamadı.");
		expect(container.textContent).toContain("Printer timeout.");
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

	function getForm() {
		const form = container.querySelector("form");
		if (!(form instanceof HTMLFormElement)) {
			throw new Error("Form not found");
		}
		return form;
	}

	function getScrollArea() {
		const scrollArea = container.querySelector('[data-testid="order-form-scroll"]');
		if (!(scrollArea instanceof HTMLDivElement)) {
			throw new Error("Scroll area not found");
		}
		return scrollArea;
	}

	function getFooter() {
		const footer = container.querySelector('[data-testid="order-form-footer"]');
		if (!(footer instanceof HTMLDivElement)) {
			throw new Error("Footer not found");
		}
		return footer;
	}

	function getPresetsContainer() {
		const presetsContainer = container.querySelector('[data-testid="order-form-presets"]');
		if (!(presetsContainer instanceof HTMLDivElement)) {
			throw new Error("Presets container not found");
		}
		return presetsContainer;
	}

	function getPresetsFade() {
		const fade = container.querySelector('[data-testid="order-form-presets-fade"]');
		if (fade !== null && !(fade instanceof HTMLDivElement)) {
			throw new Error("Presets fade is not a div");
		}
		return fade;
	}

	function getSelectedPresetPreview() {
		const preview = container.querySelector('[data-testid="selected-preset-preview"]');
		if (!(preview instanceof HTMLDivElement)) {
			throw new Error("Selected preset preview not found");
		}
		return preview;
	}

	function getPresetButton(text: string) {
		const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
			candidate.textContent?.includes(text),
		);
		if (!(button instanceof HTMLButtonElement)) {
			throw new Error(`Preset button not found: ${text}`);
		}
		return button;
	}

	async function remountWithPresets(presets: string[]) {
		await act(async () => {
			root.unmount();
		});
		vi.mocked(api.getPublicSettings).mockResolvedValueOnce({
			note_presets: JSON.stringify(presets),
		});
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		await act(async () => {
			root.render(<OrderForm />);
		});
		await act(async () => {
			await Promise.resolve();
		});
	}

	function setScrollMetrics(
		element: HTMLDivElement,
		{
			clientHeight,
			scrollHeight,
			scrollTop,
		}: {
			clientHeight: number;
			scrollHeight: number;
			scrollTop: number;
		},
	) {
		Object.defineProperty(element, "clientHeight", { configurable: true, value: clientHeight });
		Object.defineProperty(element, "scrollHeight", { configurable: true, value: scrollHeight });
		Object.defineProperty(element, "scrollTop", { configurable: true, value: scrollTop });
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
		const form = getForm();
		await act(async () => {
			form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
		});
	}
});
