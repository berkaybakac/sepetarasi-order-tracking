import { type Order, OrderStatus } from "@sepetarasi/shared";
import { describe, expect, it } from "vitest";
import {
	advancePage,
	findNewestNewReadyOrderPage,
	findOrderPageById,
} from "../src/views/display/pagination-logic";

function createReadyOrder(id: string, displayNo: number, readyAt: string): Order {
	return {
		id,
		business_date: "2026-04-13",
		display_no: displayNo,
		status: OrderStatus.READY,
		terminal_id: "t-1",
		customer_name: "Test",
		order_type: "Paket",
		target_minutes: 15,
		notes: null,
		created_at: "2026-04-13T10:00:00.000Z",
		updated_at: "2026-04-13T10:00:00.000Z",
		ready_at: readyAt,
		delivered_at: null,
		cancelled_at: null,
		items: [],
	};
}

describe("pagination-logic", () => {
	it("advancePage increments and wraps around at pageCount", () => {
		expect(advancePage(0, 3)).toBe(1);
		expect(advancePage(1, 3)).toBe(2);
		expect(advancePage(2, 3)).toBe(0); // wrap
		expect(advancePage(0, 1)).toBe(0); // single page always stays 0
	});

	it("findOrderPageById returns correct page for an order mid-list", () => {
		const readyOrders: Order[] = Array.from({ length: 12 }, (_, idx) =>
			createReadyOrder(
				`order-${idx + 1}`,
				idx + 1,
				`2026-04-13T10:${String(idx).padStart(2, "0")}:00.000Z`,
			),
		);

		// order-11 is at index 10, with pageSize=4 → page 2
		expect(findOrderPageById(readyOrders, "order-11", 4)).toBe(2);
		// order-1 is at index 0 → page 0
		expect(findOrderPageById(readyOrders, "order-1", 4)).toBe(0);
		// missing order → null
		expect(findOrderPageById(readyOrders, "order-99", 4)).toBeNull();
	});

	it("new ready order jump picks newest order page by ready_at then display_no", () => {
		const readyOrders: Order[] = [
			createReadyOrder("old-1", 1, "2026-04-13T10:00:00.000Z"),
			createReadyOrder("old-2", 2, "2026-04-13T10:01:00.000Z"),
			createReadyOrder("new-1", 3, "2026-04-13T10:02:00.000Z"),
			createReadyOrder("new-2", 4, "2026-04-13T10:03:00.000Z"),
			createReadyOrder("new-3", 99, "2026-04-13T10:03:00.000Z"),
		];
		const previousReadyIds = new Set(["old-1", "old-2"]);

		const targetPage = findNewestNewReadyOrderPage(readyOrders, previousReadyIds, 2);

		expect(targetPage).toBe(2);
	});
});
