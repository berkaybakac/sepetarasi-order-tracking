/** @vitest-environment jsdom */

import { type Order, OrderStatus } from "@sepetarasi/shared";
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderCard } from "../src/views/admin/orders/OrderCard";

function buildOrder(overrides: Partial<Order> = {}): Order {
	return {
		id: "order-1",
		business_date: "2026-04-16",
		display_no: 2,
		status: OrderStatus.DELIVERED,
		terminal_id: "KASA-1",
		customer_name: "Ben",
		order_type: "Paket",
		target_minutes: null,
		notes: "aaa",
		created_at: "2026-04-16T00:16:00.000Z",
		updated_at: "2026-04-16T00:23:18.000Z",
		ready_at: null,
		delivered_at: "2026-04-16T00:23:18.000Z",
		cancelled_at: null,
		items: [],
		...overrides,
	};
}

describe("Admin OrderCard delivery timer", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		vi.useFakeTimers();
	});

	afterEach(async () => {
		await act(async () => {
			root.unmount();
		});
		container.remove();
		vi.useRealTimers();
	});

	it("shows fixed delivered duration and does not drift over time", async () => {
		await act(async () => {
			root.render(<OrderCard order={buildOrder()} status={OrderStatus.DELIVERED} />);
		});

		expect(container.textContent).toContain("7 dk 18 sn");

		await act(async () => {
			vi.advanceTimersByTime(3 * 60 * 1000);
		});

		expect(container.textContent).toContain("7 dk 18 sn");
		expect(container.textContent).not.toContain("10 dk");
	});

	it("falls back to updated_at when delivered_at is missing", async () => {
		await act(async () => {
			root.render(
				<OrderCard
					order={buildOrder({
						delivered_at: null,
						updated_at: "2026-04-16T00:16:45.000Z",
					})}
					status={OrderStatus.DELIVERED}
				/>,
			);
		});

		expect(container.textContent).toContain("45 sn");
	});

	it("re-renders border and glow live as elapsed time crosses warning/overdue thresholds", async () => {
		// Sistem saatini sabit bir ana ayarla; kart 15 dk önce oluşmuş gibi render olsun.
		const now = new Date("2026-04-16T12:00:00.000Z");
		vi.setSystemTime(now);

		const order = buildOrder({
			id: "live-1",
			display_no: 5,
			status: OrderStatus.PREPARING,
			delivered_at: null,
			updated_at: "2026-04-16T11:45:00.000Z",
			created_at: "2026-04-16T11:45:00.000Z", // 15 dk önce
		});

		await act(async () => {
			root.render(<OrderCard order={order} status={OrderStatus.PREPARING} />);
		});

		const card = container.querySelector("article") as HTMLElement;
		expect(card).not.toBeNull();
		// 15 dk: normal (hedef 20, warning buffer 2 → 18 dk'dan sonra warning)
		expect(card.className).toContain("border-brand-warning/25");
		expect(card.className).not.toContain("border-brand-danger/55");

		// Parent tick 30s aralıklı; 3 dk + 1 tick kadar ilerlet → 18 dk elapsed → warning
		await act(async () => {
			vi.advanceTimersByTime(3 * 60 * 1000 + 1_000);
		});
		expect(card.className).toContain("border-brand-warning/50");

		// 5 dk daha ileri → 23 dk elapsed → overdue + glow
		await act(async () => {
			vi.advanceTimersByTime(5 * 60 * 1000);
		});
		expect(card.className).toContain("border-brand-danger/55");
		expect(card.className).toContain("shadow-[0_0_24px_rgba(239,68,68,0.18)]");
	});
});
