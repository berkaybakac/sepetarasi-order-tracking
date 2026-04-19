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
			{ bucket: "15-20dk", count: 1 },
			{ bucket: "20+dk", count: 1 },
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

function getRangePickerButton(container: HTMLDivElement) {
	const button = container.querySelector<HTMLButtonElement>(
		'button[aria-label="Tarih aralığını seç"]',
	);
	if (!button) {
		throw new Error("Range picker trigger not found");
	}
	return button;
}

function getCalendarDateButton(container: HTMLDivElement, iso: string) {
	const button = container.querySelector<HTMLButtonElement>(`button[data-date="${iso}"]`);
	if (!button) {
		throw new Error(`Calendar date button not found for ${iso}`);
	}
	return button;
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
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-17T14:17:00.000Z"));
		useSettingsStore.setState({ deliveryTargetMinutes: 20, loaded: true, loadFailed: false });
	});

	afterEach(async () => {
		await act(async () => {
			root.unmount();
		});
		container.remove();
		vi.useRealTimers();
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
		expect(text).toContain("Hedef 20 dk");
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
					{ bucket: "15-20dk", count: 0 },
					{ bucket: "20+dk", count: 0 },
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

	it("disables target edits until delivery target settings reload successfully", async () => {
		vi.mocked(api.getDeliveryAnalytics).mockResolvedValue(buildAnalytics());
		vi.mocked(api.getPublicSettings).mockResolvedValue({
			[SETTING_KEYS.DELIVERY_TARGET_MINUTES]: "25",
		});
		useSettingsStore.setState({ deliveryTargetMinutes: 20, loaded: true, loadFailed: true });

		await act(async () => {
			root.render(<PeriodStats />);
		});
		await act(async () => {
			await Promise.resolve();
		});

		const saveButton = Array.from(container.querySelectorAll("button")).find((node) =>
			node.textContent?.includes("Kaydet"),
		);
		const retryButton = Array.from(container.querySelectorAll("button")).find((node) =>
			node.textContent?.includes("Yeniden Dene"),
		);
		const targetInput = container.querySelector(
			'input[aria-label="Teslim hedefi dakikası"]',
		) as HTMLInputElement | null;

		expect(container.textContent).toContain(
			"Teslim hedefi yüklenemedi. Ayar doğrulanmadan düzenleme kapalı.",
		);
		expect(saveButton).toBeInstanceOf(HTMLButtonElement);
		expect((saveButton as HTMLButtonElement).disabled).toBe(true);
		expect(targetInput?.disabled).toBe(true);

		await act(async () => {
			(retryButton as HTMLButtonElement).dispatchEvent(
				new MouseEvent("click", { bubbles: true, cancelable: true }),
			);
			await Promise.resolve();
		});
		await act(async () => {
			await Promise.resolve();
		});

		expect(api.getPublicSettings).toHaveBeenCalledTimes(1);
		expect(useSettingsStore.getState().loadFailed).toBe(false);
		expect(useSettingsStore.getState().deliveryTargetMinutes).toBe(25);
		expect(
			(container.querySelector('input[aria-label="Teslim hedefi dakikası"]') as HTMLInputElement)
				.disabled,
		).toBe(false);
	});

	it("fetches analytics only once when range changes after wsTrigger becomes truthy", async () => {
		vi.mocked(api.getDeliveryAnalytics).mockResolvedValue(buildAnalytics());

		await act(async () => {
			root.render(<PeriodStats wsTrigger={0} />);
		});
		await act(async () => {
			await Promise.resolve();
		});

		expect(api.getDeliveryAnalytics).toHaveBeenCalledTimes(1);

		await act(async () => {
			root.render(<PeriodStats wsTrigger={1} />);
		});
		await act(async () => {
			await Promise.resolve();
		});

		expect(api.getDeliveryAnalytics).toHaveBeenCalledTimes(2);

		await act(async () => {
			getRangePickerButton(container).dispatchEvent(new MouseEvent("click", { bubbles: true }));
		});
		await act(async () => {
			await Promise.resolve();
		});

		await act(async () => {
			getCalendarDateButton(container, "2026-04-09").dispatchEvent(
				new MouseEvent("click", { bubbles: true }),
			);
		});
		await act(async () => {
			Array.from(container.querySelectorAll("button"))
				.find((button) => button.textContent?.trim() === "Uygula")
				?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
			await Promise.resolve();
		});
		await act(async () => {
			await Promise.resolve();
		});

		expect(api.getDeliveryAnalytics).toHaveBeenCalledTimes(3);
		expect(api.getDeliveryAnalytics).toHaveBeenLastCalledWith("2026-04-09", "2026-04-17");
	});

	it("throttles silent ws-triggered analytics refreshes", async () => {
		vi.mocked(api.getDeliveryAnalytics).mockResolvedValue(buildAnalytics());

		await act(async () => {
			root.render(<PeriodStats wsTrigger={0} />);
		});
		await act(async () => {
			await Promise.resolve();
		});

		expect(api.getDeliveryAnalytics).toHaveBeenCalledTimes(1);

		await act(async () => {
			root.render(<PeriodStats wsTrigger={1} />);
		});
		await act(async () => {
			await Promise.resolve();
		});

		expect(api.getDeliveryAnalytics).toHaveBeenCalledTimes(2);

		vi.setSystemTime(new Date("2026-04-17T14:17:05.000Z"));
		await act(async () => {
			root.render(<PeriodStats wsTrigger={2} />);
		});
		await act(async () => {
			await Promise.resolve();
		});

		expect(api.getDeliveryAnalytics).toHaveBeenCalledTimes(2);
	});

	it("keeps previous analytics visible when a silent refresh is rate-limited", async () => {
		vi.mocked(api.getDeliveryAnalytics)
			.mockResolvedValueOnce(buildAnalytics())
			.mockRejectedValueOnce(new Error("Çok fazla deneme. 1 dakika bekleyin."));

		await act(async () => {
			root.render(<PeriodStats wsTrigger={0} />);
		});
		await act(async () => {
			await Promise.resolve();
		});

		expect(container.textContent).toContain("8.5 dk");

		vi.setSystemTime(new Date("2026-04-17T14:17:20.000Z"));
		await act(async () => {
			root.render(<PeriodStats wsTrigger={1} />);
		});
		await act(async () => {
			await Promise.resolve();
		});

		expect(container.textContent).toContain("8.5 dk");
		expect(container.textContent).not.toContain("Çok fazla deneme. 1 dakika bekleyin.");
	});

	it("does not fetch analytics while the stats tab is inactive", async () => {
		vi.mocked(api.getDeliveryAnalytics).mockResolvedValue(buildAnalytics());

		await act(async () => {
			root.render(<PeriodStats active={false} wsTrigger={0} />);
		});
		await act(async () => {
			await Promise.resolve();
		});

		expect(api.getDeliveryAnalytics).not.toHaveBeenCalled();

		await act(async () => {
			root.render(<PeriodStats active wsTrigger={0} />);
		});
		await act(async () => {
			await Promise.resolve();
		});

		expect(api.getDeliveryAnalytics).toHaveBeenCalledTimes(1);
	});
});
