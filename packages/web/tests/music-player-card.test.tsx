/** @vitest-environment jsdom */

import type { MusicStatus } from "@sepetarasi/shared";
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "../src/lib/api";
import { useMusicStore } from "../src/stores/musicStore";
import { MusicPlayerCard } from "../src/views/admin/audio/MusicPlayerCard";

vi.mock("../src/lib/api", async () => {
	const actual = await vi.importActual<typeof import("../src/lib/api")>("../src/lib/api");
	return {
		...actual,
		api: {
			...actual.api,
			getMusicStatus: vi.fn(),
			musicPlay: vi.fn(),
			musicPause: vi.fn(),
			musicSkip: vi.fn(),
			musicPrevious: vi.fn(),
			setMusicMode: vi.fn(),
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

function buildStatus(overrides: Partial<MusicStatus> = {}): MusicStatus {
	return {
		isPlaying: false,
		isPaused: false,
		isDucked: false,
		currentTrackId: "track-1",
		currentTrackName: "Kasap Havası",
		volume: 30,
		enabled: true,
		loop: true,
		shuffle: false,
		runtimeIssue: null,
		...overrides,
	};
}

describe("MusicPlayerCard", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		useMusicStore.setState({ status: null });
		vi.clearAllMocks();
	});

	afterEach(async () => {
		await act(async () => {
			root.unmount();
		});
		container.remove();
	});

	it("blocks controls on load failure and allows retry", async () => {
		vi.mocked(api.getMusicStatus)
			.mockRejectedValueOnce(
				new ApiError("Ağ hatası. Bağlantınızı kontrol edin.", {
					code: "NETWORK_ERROR",
					recoverable: true,
				}),
			)
			.mockResolvedValueOnce(buildStatus());

		await act(async () => {
			root.render(<MusicPlayerCard />);
		});
		await flushEffects();

		expect(container.textContent).toContain("Oynatıcı durumu yüklenemedi. Sunucuya ulaşılamıyor.");
		expect(container.textContent).toContain("Yeniden Dene");
		expect(container.textContent).not.toContain("Kasap Havası");

		await act(async () => {
			getButton(container, "Yeniden Dene").dispatchEvent(
				new MouseEvent("click", { bubbles: true, cancelable: true }),
			);
		});
		await flushEffects();

		expect(api.getMusicStatus).toHaveBeenCalledTimes(2);
		expect(container.textContent).toContain("Kasap Havası");
		expect(container.querySelector('button[title="Sonraki parça"]')).toBeInstanceOf(
			HTMLButtonElement,
		);
	});
});
