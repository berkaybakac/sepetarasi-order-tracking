/** @vitest-environment jsdom */

import { type Order, OrderStatus } from "@sepetarasi/shared";
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderCard } from "../src/components/OrderCard";
import { api } from "../src/lib/api";

vi.mock("../src/lib/api", () => ({
	api: {
		changeStatus: vi.fn(),
	},
}));

function buildOrder(overrides: Partial<Order> = {}): Order {
	return {
		id: "order-1",
		business_date: "2026-04-16",
		display_no: 38,
		status: OrderStatus.PREPARING,
		terminal_id: "KASA-1",
		customer_name: "Uzun Isimli Musteri",
		order_type: "Paket",
		target_minutes: null,
		notes: "Standart not",
		created_at: "2026-04-16T10:00:00.000Z",
		updated_at: "2026-04-16T10:00:00.000Z",
		ready_at: null,
		delivered_at: null,
		cancelled_at: null,
		items: [],
		...overrides,
	};
}

describe("Kasa OrderCard note behavior", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		vi.mocked(api.changeStatus).mockReset();
	});

	afterEach(async () => {
		await act(async () => {
			root.unmount();
		});
		container.remove();
	});

	it("shows expandable note control for long notes and toggles expanded state", async () => {
		const longNote = "x".repeat(160);
		await act(async () => {
			root.render(<OrderCard order={buildOrder({ notes: longNote })} />);
		});

		const noteText = container.querySelector('[data-testid="order-card-note"]');
		if (!(noteText instanceof HTMLParagraphElement)) throw new Error("Note paragraph not found");
		expect(noteText.className).toContain("-webkit-line-clamp:3");

		const expandButton = Array.from(container.querySelectorAll("button")).find((button) =>
			button.textContent?.includes("Notun tamamını göster"),
		);
		if (!(expandButton instanceof HTMLButtonElement)) throw new Error("Expand button not found");

		await act(async () => {
			expandButton.click();
		});

		expect(expandButton.textContent).toContain("Notu daralt");
		expect(noteText.className).toContain("max-h-24");
		expect(noteText.className).toContain("overflow-y-auto");
	});

	it("stretches the card and keeps action buttons anchored at the bottom", async () => {
		await act(async () => {
			root.render(<OrderCard order={buildOrder({ notes: "Kisa not" })} />);
		});

		const cardRoot = container.querySelector('[data-testid="order-card-root"]');
		const cardContent = container.querySelector('[data-testid="order-card-content"]');
		const actions = container.querySelector('[data-testid="order-card-actions"]');

		if (!(cardRoot instanceof HTMLDivElement)) throw new Error("Card root not found");
		if (!(cardContent instanceof HTMLDivElement)) throw new Error("Card content not found");
		if (!(actions instanceof HTMLDivElement)) throw new Error("Card actions not found");

		expect(cardRoot.className).toContain("h-full");
		expect(cardContent.className).toContain("flex");
		expect(cardContent.className).toContain("flex-col");
		expect(cardContent.className).toContain("h-full");
		expect(actions.className).toContain("mt-auto");
		expect(actions.className).toContain("pt-3");
	});

	it("does not render expandable note control for short notes", async () => {
		await act(async () => {
			root.render(<OrderCard order={buildOrder({ notes: "Kisa not" })} />);
		});

		const expandButton = Array.from(container.querySelectorAll("button")).find((button) =>
			button.textContent?.includes("Notun tamamını göster"),
		);
		expect(expandButton).toBeUndefined();
	});

	it("allows marking the order ready after expanding a long note", async () => {
		const longNote = "x".repeat(160);
		vi.mocked(api.changeStatus).mockResolvedValueOnce(
			buildOrder({
				status: OrderStatus.READY,
				notes: longNote,
				ready_at: "2026-04-16T10:05:00.000Z",
			}),
		);

		await act(async () => {
			root.render(<OrderCard order={buildOrder({ notes: longNote })} />);
		});

		const expandButton = Array.from(container.querySelectorAll("button")).find((button) =>
			button.textContent?.includes("Notun tamamını göster"),
		);
		if (!(expandButton instanceof HTMLButtonElement)) throw new Error("Expand button not found");

		await act(async () => {
			expandButton.click();
		});

		const readyButton = Array.from(container.querySelectorAll("button")).find((button) =>
			button.textContent?.includes("Hazır"),
		);
		if (!(readyButton instanceof HTMLButtonElement)) throw new Error("Ready button not found");

		await act(async () => {
			readyButton.click();
			await Promise.resolve();
		});

		expect(api.changeStatus).toHaveBeenCalledWith("order-1", { status: OrderStatus.READY });
		expect(container.textContent).toContain("Notu daralt");
	});
});
