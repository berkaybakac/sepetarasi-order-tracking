/** @vitest-environment jsdom */

import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrdersTab } from "../src/views/admin/tabs/OrdersTab";

let initialLoadSettled = false;

vi.mock("../src/stores/orderStore", () => ({
	useOrderStore: (selector: (state: { initialLoadSettled: boolean }) => unknown) =>
		selector({
			initialLoadSettled,
		}),
}));

vi.mock("../src/views/admin/OrderColumns", () => ({
	OrderColumns: ({ animateEntries = true }: { animateEntries?: boolean }) => (
		<div data-order-columns-animation={animateEntries ? "enabled" : "disabled"}>order-columns</div>
	),
	StatCards: () => <div>stat-cards</div>,
}));

describe("OrdersTab", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		initialLoadSettled = false;
	});

	afterEach(async () => {
		await act(async () => {
			root.unmount();
		});
		container.remove();
	});

	it("shows the stable loading layout until the first order hydration settles", async () => {
		await act(async () => {
			root.render(<OrdersTab />);
		});

		expect(container.querySelector('[data-orders-tab-state="loading"]')).not.toBeNull();
		expect(container.textContent).not.toContain("stat-cards");
		expect(container.textContent).not.toContain("order-columns");
	});

	it("renders the live content without first-mount entry animations on the first settled frame", async () => {
		initialLoadSettled = true;

		await act(async () => {
			root.render(<OrdersTab />);
		});

		expect(container.querySelector('[data-orders-tab-state="loading"]')).toBeNull();
		expect(container.textContent).toContain("stat-cards");
		expect(container.textContent).toContain("order-columns");
		expect(container.querySelector('[data-order-columns-animation="disabled"]')).not.toBeNull();
	});
});
