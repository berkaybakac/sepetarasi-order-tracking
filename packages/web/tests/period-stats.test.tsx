/** @vitest-environment jsdom */

import { type DayStats, OrderStatus } from "@sepetarasi/shared";
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/lib/api";
import { PeriodStats } from "../src/views/admin/PeriodStats";

vi.mock("../src/lib/api", () => ({
	api: {
		getStatsByPeriod: vi.fn(),
	},
}));

function buildStats(overrides: Partial<DayStats> = {}): DayStats {
	return {
		totalOrders: 6,
		byStatus: {
			[OrderStatus.PREPARING]: 1,
			[OrderStatus.READY]: 2,
			[OrderStatus.DELIVERED]: 3,
			[OrderStatus.CANCELLED]: 1,
		},
		averagePrepMinutes: 9.4,
		averageDeliverySeconds: 1038,
		...overrides,
	};
}

describe("PeriodStats delivery metric", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		vi.clearAllMocks();
	});

	afterEach(async () => {
		await act(async () => {
			root.unmount();
		});
		container.remove();
	});

	it("renders average delivery time and delivered-order pill", async () => {
		vi.mocked(api.getStatsByPeriod).mockResolvedValueOnce(buildStats());

		await act(async () => {
			root.render(<PeriodStats />);
		});
		await act(async () => {
			await Promise.resolve();
		});

		expect(container.textContent).toContain("Ortalama Teslim Süresi");
		expect(container.textContent).toContain("17.3");
		expect(container.textContent).toContain("dk");
		expect(container.textContent).toContain("3 teslim edilen sipariş");
	});

	it("drops trailing .0 for whole-minute averages", async () => {
		vi.mocked(api.getStatsByPeriod).mockResolvedValueOnce(
			buildStats({
				averageDeliverySeconds: 1020,
			}),
		);

		await act(async () => {
			root.render(<PeriodStats />);
		});
		await act(async () => {
			await Promise.resolve();
		});

		expect(container.textContent).toContain("17");
		expect(container.textContent).not.toContain("17.0");
	});
});
