/** @vitest-environment jsdom */

import { type Order, OrderStatus } from "@sepetarasi/shared";
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	DELIVERED_SCROLL_THRESHOLD_PX,
	DELIVERED_SCROLL_TRIGGER_COUNT,
	OrderColumn,
} from "../src/views/admin/orders/OrderColumn";

const ordersByStatus: Record<string, Order[]> = {};

vi.mock("../src/stores/orderStore", () => ({
	useOrdersByStatus: (status: string) => ordersByStatus[status] ?? [],
}));

vi.mock("../src/views/admin/orders/OrderCard", () => ({
	OrderCard: ({ order }: { order: Order }) => <article>{order.display_no}</article>,
}));

function buildOrder(index: number, status: OrderStatus): Order {
	return {
		id: `order-${status}-${index}`,
		business_date: "2026-04-18",
		display_no: index + 1,
		status,
		terminal_id: "KASA-1",
		customer_name: `Musteri ${index + 1}`,
		order_type: "Paket",
		target_minutes: null,
		notes: null,
		created_at: "2026-04-18T10:00:00.000Z",
		updated_at: "2026-04-18T10:05:00.000Z",
		ready_at: null,
		delivered_at: status === OrderStatus.DELIVERED ? "2026-04-18T10:10:00.000Z" : null,
		cancelled_at: null,
		items: [],
	};
}

function buildOrders(count: number, status: OrderStatus) {
	return Array.from({ length: count }, (_, index) => buildOrder(index, status));
}

describe("Admin OrderColumn delivered scroll behavior", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		for (const key of Object.keys(ordersByStatus)) {
			delete ordersByStatus[key];
		}
	});

	afterEach(async () => {
		await act(async () => {
			root.unmount();
		});
		container.remove();
	});

	it("keeps delivered column naturally flowing below the scroll threshold", async () => {
		ordersByStatus[OrderStatus.DELIVERED] = buildOrders(
			DELIVERED_SCROLL_TRIGGER_COUNT - 1,
			OrderStatus.DELIVERED,
		);

		await act(async () => {
			root.render(
				<OrderColumn
					status={OrderStatus.DELIVERED}
					title="Teslim Edildi"
					dotClass="bg-brand-primary"
					countClass="text-brand-primary"
				/>,
			);
		});

		const orderList = container.querySelector(
			'[data-order-list-status="DELIVERED"]',
		) as HTMLDivElement | null;
		expect(orderList).not.toBeNull();
		expect(orderList?.dataset.orderListScrollable).toBe("false");
		expect(orderList?.className).not.toContain("overflow-y-auto");
		expect(orderList?.style.maxHeight).toBe("");
	});

	it("adds an internal scroll only for delivered orders once the threshold is reached", async () => {
		ordersByStatus[OrderStatus.DELIVERED] = buildOrders(
			DELIVERED_SCROLL_TRIGGER_COUNT,
			OrderStatus.DELIVERED,
		);

		await act(async () => {
			root.render(
				<OrderColumn
					status={OrderStatus.DELIVERED}
					title="Teslim Edildi"
					dotClass="bg-brand-primary"
					countClass="text-brand-primary"
				/>,
			);
		});

		const orderList = container.querySelector(
			'[data-order-list-status="DELIVERED"]',
		) as HTMLDivElement | null;
		expect(orderList).not.toBeNull();
		expect(orderList?.dataset.orderListScrollable).toBe("true");
		expect(orderList?.className).toContain("overflow-y-auto");
		expect(orderList?.style.maxHeight).toBe(`${DELIVERED_SCROLL_THRESHOLD_PX}px`);
	});

	it("does not enable the delivered overflow behavior for other statuses", async () => {
		ordersByStatus[OrderStatus.READY] = buildOrders(
			DELIVERED_SCROLL_TRIGGER_COUNT + 10,
			OrderStatus.READY,
		);

		await act(async () => {
			root.render(
				<OrderColumn
					status={OrderStatus.READY}
					title="Hazir"
					dotClass="bg-brand-success"
					countClass="text-brand-success"
				/>,
			);
		});

		const orderList = container.querySelector(
			'[data-order-list-status="READY"]',
		) as HTMLDivElement | null;
		expect(orderList).not.toBeNull();
		expect(orderList?.dataset.orderListScrollable).toBe("false");
		expect(orderList?.className).not.toContain("overflow-y-auto");
		expect(orderList?.style.maxHeight).toBe("");
	});
});
