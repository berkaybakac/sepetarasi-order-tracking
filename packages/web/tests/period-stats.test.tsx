/** @vitest-environment jsdom */

import { type DeliveryAnalyticsResult, SETTING_KEYS } from "@sepetarasi/shared";
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/lib/api";
import { useSettingsStore } from "../src/stores/settingsStore";
import { PeriodStats } from "../src/views/admin/PeriodStats";

vi.mock("../src/lib/api", () => ({
	api: {
		getDeliveryAnalytics: vi.fn(),
		getPublicSettings: vi.fn().mockResolvedValue({}),
		updateSetting: vi.fn(),
	},
}));

function buildAnalytics(overrides: Partial<DeliveryAnalyticsResult> = {}): DeliveryAnalyticsResult {
	return {
		range: { from: "2026-04-10", to: "2026-04-17" },
		summary: {
			averageDeliveryMinutes: 8.5,
			totalDelivered: 42,
			targetMinutes: 20,
			previousPeriodAvgMinutes: 9.6,
			trendPercent: -11.5,
			onTargetRate: 86,
			onTargetCount: 36,
		},
		timeSeries: {
			granularity: "day",
			points: [
				{ bucket: "2026-04-11", averageDeliveryMinutes: 9, deliveredCount: 5 },
				{ bucket: "2026-04-12", averageDeliveryMinutes: 8, deliveredCount: 7 },
			],
		},
		distribution: [
			{ bucket: "0-5dk", count: 8 },
			{ bucket: "5-10dk", count: 22 },
			{ bucket: "10-15dk", count: 10 },
			{ bucket: "15+dk", count: 2 },
		],
		byOrderType: [{ orderType: "Paket", averageDeliveryMinutes: 9.2, deliveredCount: 28 }],
		...overrides,
	};
}

function setInputValue(input: HTMLInputElement, value: string) {
	const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
	if (!setter) {
		throw new Error("HTMLInputElement value setter not found");
	}
	setter.call(input, value);
	input.dispatchEvent(new Event("input", { bubbles: true }));
	input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("PeriodStats — delivery analytics dashboard", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		vi.clearAllMocks();
		useSettingsStore.setState({ deliveryTargetMinutes: 20, loaded: true });
	});

	afterEach(async () => {
		await act(async () => {
			root.unmount();
		});
		container.remove();
	});

	it("renders KPI cards, target hint, presets, distribution", async () => {
		vi.mocked(api.getDeliveryAnalytics).mockResolvedValue(buildAnalytics());

		await act(async () => {
			root.render(<PeriodStats />);
		});
		await act(async () => {
			await Promise.resolve();
		});

		const text = container.textContent ?? "";
		expect(text).toContain("Ortalama Teslim Süresi");
		expect(text).toContain("Hedef:");
		expect(text).toContain("20 dk");
		expect(text).toContain("8.5 dk");
		expect(text).toContain("42");
		expect(text).toContain("%86");
		expect(text).toContain("Son 7 Gün");
		expect(text).toContain("Süre Dağılımı");
		expect(text).toContain("0-5dk");
		expect(text).toContain("Paket");
	});

	it("shows empty state when no deliveries in the selected range", async () => {
		vi.mocked(api.getDeliveryAnalytics).mockResolvedValue(
			buildAnalytics({
				summary: {
					averageDeliveryMinutes: 0,
					totalDelivered: 0,
					targetMinutes: 20,
					previousPeriodAvgMinutes: 0,
					trendPercent: 0,
					onTargetRate: 0,
					onTargetCount: 0,
				},
				timeSeries: { granularity: "day", points: [] },
				distribution: [
					{ bucket: "0-5dk", count: 0 },
					{ bucket: "5-10dk", count: 0 },
					{ bucket: "10-15dk", count: 0 },
					{ bucket: "15+dk", count: 0 },
				],
				byOrderType: [],
			}),
		);

		await act(async () => {
			root.render(<PeriodStats />);
		});
		await act(async () => {
			await Promise.resolve();
		});

		expect(container.textContent).toContain("Bu aralıkta teslim edilen sipariş yok");
	});

	it("saves the delivery target and refetches analytics", async () => {
		vi.mocked(api.getDeliveryAnalytics)
			.mockResolvedValueOnce(buildAnalytics())
			.mockResolvedValueOnce(
				buildAnalytics({
					summary: {
						averageDeliveryMinutes: 8.5,
						totalDelivered: 42,
						targetMinutes: 30,
						previousPeriodAvgMinutes: 9.6,
						trendPercent: -11.5,
						onTargetRate: 86,
						onTargetCount: 36,
					},
				}),
			);
		vi.mocked(api.getPublicSettings).mockResolvedValue({
			[SETTING_KEYS.DELIVERY_TARGET_MINUTES]: "30",
		});
		vi.mocked(api.updateSetting).mockResolvedValue(null);

		await act(async () => {
			root.render(<PeriodStats />);
		});
		await act(async () => {
			await Promise.resolve();
		});

		const input = container.querySelector<HTMLInputElement>(
			'input[aria-label="Teslim hedefi dakikası"]',
		);
		const saveButton = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent?.trim() === "Kaydet",
		);

		expect(input).not.toBeNull();
		expect(saveButton).not.toBeNull();

		await act(async () => {
			setInputValue(input!, "30");
		});

		await act(async () => {
			saveButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
			await Promise.resolve();
		});
		await act(async () => {
			await Promise.resolve();
		});

		expect(api.updateSetting).toHaveBeenCalledWith(SETTING_KEYS.DELIVERY_TARGET_MINUTES, "30");
		expect(api.getPublicSettings).toHaveBeenCalledTimes(1);
		expect(api.getDeliveryAnalytics).toHaveBeenCalledTimes(2);
		expect(container.textContent).toContain("30 dk");
		expect(container.textContent).toContain("Kaydedildi");
	});

	it("preserves the in-progress target draft when the store re-hydrates from WS", async () => {
		vi.mocked(api.getDeliveryAnalytics).mockResolvedValue(buildAnalytics());

		await act(async () => {
			root.render(<PeriodStats />);
		});
		await act(async () => {
			await Promise.resolve();
		});

		const input = container.querySelector<HTMLInputElement>(
			'input[aria-label="Teslim hedefi dakikası"]',
		);
		expect(input).not.toBeNull();

		// Kullanıcı 25 yazsın (dirty) — store hâlâ 20.
		await act(async () => {
			setInputValue(input!, "25");
		});
		expect(input!.value).toBe("25");

		// Başka admin 28'e kaydetti → WS → store güncellendi. Dirty draft silinmemeli.
		await act(async () => {
			useSettingsStore.setState({ deliveryTargetMinutes: 28 });
		});
		await act(async () => {
			await Promise.resolve();
		});

		expect(input!.value).toBe("25");
	});

	it("shows an inline error when target save fails", async () => {
		vi.mocked(api.getDeliveryAnalytics).mockResolvedValue(buildAnalytics());
		vi.mocked(api.updateSetting).mockRejectedValue(new Error("Teslim hedefi kaydedilemedi"));

		await act(async () => {
			root.render(<PeriodStats />);
		});
		await act(async () => {
			await Promise.resolve();
		});

		const input = container.querySelector<HTMLInputElement>(
			'input[aria-label="Teslim hedefi dakikası"]',
		);
		const saveButton = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent?.trim() === "Kaydet",
		);

		await act(async () => {
			setInputValue(input!, "25");
		});

		await act(async () => {
			saveButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
			await Promise.resolve();
		});
		await act(async () => {
			await Promise.resolve();
		});

		expect(api.updateSetting).toHaveBeenCalledWith(SETTING_KEYS.DELIVERY_TARGET_MINUTES, "25");
		expect(container.textContent).toContain("Teslim hedefi kaydedilemedi");
	});
});
