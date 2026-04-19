/** @vitest-environment jsdom */

import type { MusicStatus, MusicTrack } from "@sepetarasi/shared";
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "../src/lib/api";
import { useMusicStore } from "../src/stores/musicStore";
import { MusicLibraryCard } from "../src/views/admin/audio/MusicLibraryCard";

vi.mock("../src/lib/api", async () => {
	const actual = await vi.importActual<typeof import("../src/lib/api")>("../src/lib/api");
	return {
		...actual,
		api: {
			...actual.api,
			getMusicTracks: vi.fn(),
			getMusicDisk: vi.fn(),
			getMusicStatus: vi.fn(),
			deleteMusicTrack: vi.fn(),
			uploadMusicTrack: vi.fn(),
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

function buildTrack(overrides: Partial<MusicTrack> = {}): MusicTrack {
	return {
		id: "track-1",
		filename: "kasap-havasi.mp3",
		display_name: "Kasap Havasi",
		file_size: 123_456,
		duration_seconds: 95,
		sort_order: 0,
		uploaded_at: "2026-04-18T12:00:00.000Z",
		...overrides,
	};
}

function buildStatus(overrides: Partial<MusicStatus> = {}): MusicStatus {
	return {
		isPlaying: false,
		isPaused: false,
		isDucked: false,
		currentTrackId: null,
		currentTrackName: null,
		volume: 40,
		enabled: true,
		loop: true,
		shuffle: false,
		runtimeIssue: null,
		...overrides,
	};
}

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

function createDeferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

describe("MusicLibraryCard", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		useMusicStore.setState({ status: null });
		vi.clearAllMocks();
		vi.mocked(api.getMusicDisk).mockResolvedValue(null);
		vi.mocked(api.getMusicStatus).mockResolvedValue(buildStatus());
		vi.mocked(api.deleteMusicTrack).mockResolvedValue(null);
		vi.mocked(api.uploadMusicTrack).mockResolvedValue(buildTrack());
	});

	afterEach(async () => {
		await act(async () => {
			root.unmount();
		});
		container.remove();
	});

	it("shows retry instead of an empty library when the initial load fails", async () => {
		vi.mocked(api.getMusicTracks)
			.mockRejectedValueOnce(
				new ApiError("Ağ hatası. Bağlantınızı kontrol edin.", {
					code: "NETWORK_ERROR",
					recoverable: true,
				}),
			)
			.mockResolvedValueOnce([buildTrack()]);

		await act(async () => {
			root.render(<MusicLibraryCard />);
		});
		await flushEffects();

		expect(container.textContent).toContain(
			"Müzik kütüphanesi yüklenemedi. Sunucuya ulaşılamıyor.",
		);
		expect(container.textContent).toContain("Yeniden Dene");
		expect(container.textContent).not.toContain("Henüz parça eklenmedi");

		await act(async () => {
			getButton(container, "Yeniden Dene").dispatchEvent(
				new MouseEvent("click", { bubbles: true, cancelable: true }),
			);
		});
		await flushEffects();

		expect(api.getMusicTracks).toHaveBeenCalledTimes(2);
		expect(container.textContent).toContain("Kasap Havasi");
	});

	it("warns before unload while an upload is active and removes the warning after completion", async () => {
		vi.mocked(api.getMusicTracks).mockResolvedValue([]);
		const uploadDeferred = createDeferred<MusicTrack>();
		vi.mocked(api.uploadMusicTrack).mockImplementation(() => uploadDeferred.promise);

		await act(async () => {
			root.render(<MusicLibraryCard />);
		});
		await flushEffects();

		const fileInput = container.querySelector('input[type="file"]');
		if (!(fileInput instanceof HTMLInputElement)) {
			throw new Error("File input not found");
		}

		Object.defineProperty(fileInput, "files", {
			configurable: true,
			value: [new File(["mp3"], "yukleme.mp3", { type: "audio/mpeg" })],
		});

		await act(async () => {
			fileInput.dispatchEvent(new Event("change", { bubbles: true }));
			await Promise.resolve();
		});
		await flushEffects();

		expect(container.textContent).toContain(
			"Yükleme sürerken sayfayı yenilemeyin, sekmeyi kapatmayın veya uygulamadan çıkmayın.",
		);

		const activeBeforeUnloadEvent = new Event("beforeunload", { cancelable: true });
		expect(window.dispatchEvent(activeBeforeUnloadEvent)).toBe(false);
		expect(activeBeforeUnloadEvent.defaultPrevented).toBe(true);

		await act(async () => {
			uploadDeferred.resolve(buildTrack({ id: "track-2", filename: "yukleme.mp3" }));
			await uploadDeferred.promise;
		});
		await flushEffects();

		expect(container.textContent).not.toContain(
			"Yükleme sürerken sayfayı yenilemeyin, sekmeyi kapatmayın veya uygulamadan çıkmayın.",
		);

		const completedBeforeUnloadEvent = new Event("beforeunload", { cancelable: true });
		expect(window.dispatchEvent(completedBeforeUnloadEvent)).toBe(true);
		expect(completedBeforeUnloadEvent.defaultPrevented).toBe(false);
	});
});
