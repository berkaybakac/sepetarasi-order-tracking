/** @vitest-environment jsdom */

import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/lib/api";
import { VolumeControlCard } from "../src/views/admin/audio/VolumeControlCard";

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

describe("VolumeControlCard", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
	});

	afterEach(async () => {
		await act(async () => {
			root.unmount();
		});
		container.remove();
		vi.clearAllMocks();
	});

	it("blocks controls on load failure and allows retry", async () => {
		const onMount = vi
			.fn()
			.mockRejectedValueOnce(
				new ApiError("Ağ hatası. Bağlantınızı kontrol edin.", {
					code: "NETWORK_ERROR",
					recoverable: true,
				}),
			)
			.mockResolvedValueOnce({ volume: 35, enabled: true });

		await act(async () => {
			root.render(
				<VolumeControlCard
					title="Anons Sesi"
					icon={<span>i</span>}
					defaultVolume={100}
					colorScheme="blue"
					onMount={onMount}
					onSave={vi.fn().mockResolvedValue(null)}
				/>,
			);
		});
		await flushEffects();

		expect(container.textContent).toContain("Ses ayarları yüklenemedi. Sunucuya ulaşılamıyor.");
		expect(container.textContent).toContain("Yeniden Dene");
		expect(container.querySelector('input[type="range"]')).toBeNull();

		await act(async () => {
			getButton(container, "Yeniden Dene").dispatchEvent(
				new MouseEvent("click", { bubbles: true, cancelable: true }),
			);
		});
		await flushEffects();

		const slider = container.querySelector('input[type="range"]');
		expect(onMount).toHaveBeenCalledTimes(2);
		expect(slider).toBeInstanceOf(HTMLInputElement);
		expect((slider as HTMLInputElement).value).toBe("35");
	});
});
