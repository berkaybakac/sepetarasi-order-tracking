import type { Order } from "@sepetarasi/shared";
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
		status: "READY",
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
	it("nowPlaying jump can override timer tick when applied last", () => {
		const readyOrders: Order[] = Array.from({ length: 12 }, (_, idx) =>
			createReadyOrder(
				`order-${idx + 1}`,
				idx + 1,
				`2026-04-13T10:${String(idx).padStart(2, "0")}:00.000Z`,
			),
		);

		const pageCount = 3;
		const pageAfterTick = advancePage(0, pageCount);
		const nowPlayingTargetPage = findOrderPageById(readyOrders, "order-11", 4);
		const finalPage = nowPlayingTargetPage ?? pageAfterTick;

		expect(pageAfterTick).toBe(1);
		expect(nowPlayingTargetPage).toBe(2);
		expect(finalPage).toBe(2);
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
