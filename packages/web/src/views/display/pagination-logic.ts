import type { Order } from "@sepetarasi/shared";

export function advancePage(currentPage: number, pageCount: number): number {
	const safePageCount = pageCount > 0 ? pageCount : 1;
	return (currentPage + 1) % safePageCount;
}

export function findOrderPageById(
	orders: Order[],
	orderId: string,
	maxVisiblePerColumn: number,
): number | null {
	const safeMaxVisible = Math.max(1, maxVisiblePerColumn);
	const idx = orders.findIndex((order) => order.id === orderId);
	if (idx < 0) return null;
	return Math.floor(idx / safeMaxVisible);
}

export function findNewestNewReadyOrderPage(
	readyOrders: Order[],
	previousReadyIds: Set<string>,
	maxVisiblePerColumn: number,
): number | null {
	const safeMaxVisible = Math.max(1, maxVisiblePerColumn);

	let newestIdx = -1;
	let newestOrder: Order | null = null;
	for (let idx = 0; idx < readyOrders.length; idx += 1) {
		const order = readyOrders[idx];
		if (previousReadyIds.has(order.id)) continue;

		if (!newestOrder) {
			newestOrder = order;
			newestIdx = idx;
			continue;
		}

		const currentReadyAt = order.ready_at ?? "";
		const latestReadyAt = newestOrder.ready_at ?? "";
		if (
			currentReadyAt > latestReadyAt ||
			(currentReadyAt === latestReadyAt && order.display_no > newestOrder.display_no)
		) {
			newestOrder = order;
			newestIdx = idx;
		}
	}

	if (newestIdx < 0) return null;
	return Math.floor(newestIdx / safeMaxVisible);
}
