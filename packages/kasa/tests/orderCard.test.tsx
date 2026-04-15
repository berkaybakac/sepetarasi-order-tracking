/** @vitest-environment jsdom */

import { type Order, OrderStatus } from "@sepetarasi/shared";
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OrderCard } from "../src/components/OrderCard";

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

		const noteText = container.querySelector(".bg-amber-500\\/10 p");
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

	it("does not render expandable note control for short notes", async () => {
		await act(async () => {
			root.render(<OrderCard order={buildOrder({ notes: "Kisa not" })} />);
		});

		const expandButton = Array.from(container.querySelectorAll("button")).find((button) =>
			button.textContent?.includes("Notun tamamını göster"),
		);
		expect(expandButton).toBeUndefined();
	});
});
