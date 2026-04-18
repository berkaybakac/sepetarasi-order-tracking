/** @vitest-environment jsdom */

import { SETTING_KEYS } from "@sepetarasi/shared";
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "../src/lib/api";
import { DisplaySettingsCard } from "../src/views/admin/DisplaySettingsCard";

vi.mock("../src/lib/api", async () => {
	const actual = await vi.importActual<typeof import("../src/lib/api")>("../src/lib/api");
	return {
		...actual,
		api: {
			...actual.api,
			getPublicSettings: vi.fn(),
			updateSettingsBulk: vi.fn(),
		},
	};
});

vi.mock("../src/lib/logger", () => ({
	logger: {
		error: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
	},
}));

async function flushEffects() {
	await act(async () => {
		await Promise.resolve();
		await Promise.resolve();
	});
}

function getButton(container: HTMLDivElement, label: string) {
	const button = Array.from(container.querySelectorAll("button")).find((node) =>
		node.textContent?.includes(label),
	);

	if (!(button instanceof HTMLButtonElement)) {
		throw new Error(`Button not found: ${label}`);
	}

	return button;
}

describe("DisplaySettingsCard", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		vi.clearAllMocks();
		vi.mocked(api.updateSettingsBulk).mockResolvedValue(null);
	});

	afterEach(async () => {
		await act(async () => {
			root.unmount();
		});
		container.remove();
	});

	it("loads config from the public settings endpoint", async () => {
		vi.mocked(api.getPublicSettings).mockResolvedValue({
			[SETTING_KEYS.RESTAURANT_NAME]: "Sepetarasi",
		});

		await act(async () => {
			root.render(<DisplaySettingsCard />);
		});
		await flushEffects();

		expect(api.getPublicSettings).toHaveBeenCalledTimes(1);
		const input = container.querySelector("#restaurant-name");
		expect(input).toBeInstanceOf(HTMLInputElement);
		expect((input as HTMLInputElement).value).toBe("Sepetarasi");
	});

	it("blocks editing on load failure and allows retry", async () => {
		vi.mocked(api.getPublicSettings)
			.mockRejectedValueOnce(
				new ApiError("Ağ hatası. Bağlantınızı kontrol edin.", {
					code: "NETWORK_ERROR",
					recoverable: true,
				}),
			)
			.mockResolvedValueOnce({
				[SETTING_KEYS.RESTAURANT_NAME]: "Sepetarasi",
			});

		await act(async () => {
			root.render(<DisplaySettingsCard />);
		});
		await flushEffects();

		expect(container.textContent).toContain("Ayarlar yüklenemedi. Sunucuya ulaşılamıyor.");
		expect(container.textContent).toContain("Yeniden Dene");
		expect(container.querySelector("#restaurant-name")).toBeNull();

		await act(async () => {
			getButton(container, "Yeniden Dene").dispatchEvent(
				new MouseEvent("click", { bubbles: true, cancelable: true }),
			);
		});
		await flushEffects();

		expect(api.getPublicSettings).toHaveBeenCalledTimes(2);
		expect(container.querySelector("#restaurant-name")).toBeInstanceOf(HTMLInputElement);
	});
});
