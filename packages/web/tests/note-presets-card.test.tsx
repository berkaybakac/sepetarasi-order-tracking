/** @vitest-environment jsdom */

import { SETTING_KEYS } from "@sepetarasi/shared";
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "../src/lib/api";
import { NotePresetsCard } from "../src/views/admin/NotePresetsCard";

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

function getInput(container: HTMLDivElement) {
	const input = container.querySelector("#note-preset-input");

	if (!(input instanceof HTMLInputElement)) {
		throw new Error("Input not found");
	}

	return input;
}

function setInputValue(input: HTMLInputElement, value: string) {
	const valueSetter = Object.getOwnPropertyDescriptor(
		window.HTMLInputElement.prototype,
		"value",
	)?.set;

	if (!valueSetter) {
		throw new Error("Input value setter not found");
	}

	valueSetter.call(input, value);
	input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("NotePresetsCard", () => {
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

	it("loads presets from the public settings endpoint", async () => {
		vi.mocked(api.getPublicSettings).mockResolvedValue({
			[SETTING_KEYS.NOTE_PRESETS]: JSON.stringify(["Ketçap bol", "Acılı"]),
		});

		await act(async () => {
			root.render(<NotePresetsCard />);
		});
		await flushEffects();

		expect(api.getPublicSettings).toHaveBeenCalledTimes(1);
		expect(container.textContent).toContain("Ketçap bol");
		expect(container.textContent).toContain("Acılı");
		expect(container.textContent).not.toContain("Hazır notlar yüklenemedi");
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
				[SETTING_KEYS.NOTE_PRESETS]: JSON.stringify(["Ketçap bol"]),
			});

		await act(async () => {
			root.render(<NotePresetsCard />);
		});
		await flushEffects();

		expect(container.textContent).toContain("Hazır notlar yüklenemedi. Sunucuya ulaşılamıyor.");
		expect(container.textContent).toContain("Yeniden Dene");
		expect(container.textContent).not.toContain("Henüz hazır not yok");
		expect(container.querySelector("#note-preset-input")).toBeNull();

		await act(async () => {
			getButton(container, "Yeniden Dene").dispatchEvent(
				new MouseEvent("click", { bubbles: true, cancelable: true }),
			);
		});
		await flushEffects();

		expect(api.getPublicSettings).toHaveBeenCalledTimes(2);
		expect(container.textContent).toContain("Ketçap bol");
		expect(container.querySelector("#note-preset-input")).not.toBeNull();
	});

	it("adds a note and saves immediately without a separate save step", async () => {
		vi.mocked(api.getPublicSettings).mockResolvedValue({
			[SETTING_KEYS.NOTE_PRESETS]: JSON.stringify(["Ketçap bol"]),
		});

		await act(async () => {
			root.render(<NotePresetsCard />);
		});
		await flushEffects();

		const input = getInput(container);

		await act(async () => {
			setInputValue(input, "Acısız");
		});

		await act(async () => {
			getButton(container, "Notu Ekle").dispatchEvent(
				new MouseEvent("click", { bubbles: true, cancelable: true }),
			);
		});
		await flushEffects();

		expect(api.updateSettingsBulk).toHaveBeenCalledWith({
			[SETTING_KEYS.NOTE_PRESETS]: JSON.stringify(["Ketçap bol", "Acısız"]),
		});
		expect(container.textContent).toContain("Not eklendi");
		expect(container.textContent).not.toContain("Kaydet");
	});

	it("removes a note and saves immediately", async () => {
		vi.mocked(api.getPublicSettings).mockResolvedValue({
			[SETTING_KEYS.NOTE_PRESETS]: JSON.stringify(["Ketçap bol", "Acılı"]),
		});

		await act(async () => {
			root.render(<NotePresetsCard />);
		});
		await flushEffects();

		await act(async () => {
			getButton(container, "Sil").dispatchEvent(
				new MouseEvent("click", { bubbles: true, cancelable: true }),
			);
		});
		await flushEffects();

		expect(api.updateSettingsBulk).toHaveBeenCalledWith({
			[SETTING_KEYS.NOTE_PRESETS]: JSON.stringify(["Acılı"]),
		});
		expect(container.textContent).toContain("Not kaldırıldı");
	});
});
