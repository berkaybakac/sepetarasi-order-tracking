/** @vitest-environment jsdom */

import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServerConfig } from "../src/components/ServerConfig";
import { setBaseUrl, setCashierToken, setTerminalId } from "../src/lib/api";

vi.mock("../src/lib/api", () => ({
	getBaseUrl: vi.fn(() => "http://localhost:3000"),
	setBaseUrl: vi.fn(),
	setTerminalId: vi.fn(),
	setCashierToken: vi.fn(),
}));

vi.mock("../src/lib/electron", () => ({
	getElectronAPI: () => window.electronAPI,
	reportRendererError: vi.fn(),
}));

const baseConfig = {
	serverUrl: "http://sepetarasi.local:3000",
	terminalId: "KASA-1",
	terminalName: "Kasa 1",
	hotkey: "Ctrl+Shift+O",
	printerIp: "192.168.1.12",
	printerCodePage: 61,
	printerEncoding: "cp857",
	cashierToken: "cashier-secret",
};

function normalizeText(value: string | null | undefined) {
	return value?.replace(/\s+/g, " ").trim() ?? "";
}

describe("ServerConfig", () => {
	let container: HTMLDivElement;
	let root: Root;
	let onConnected: ReturnType<typeof vi.fn>;
	let saveConfig: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		onConnected = vi.fn();
		saveConfig = vi.fn().mockResolvedValue(true);

		Object.defineProperty(window, "electronAPI", {
			value: {
				getConfig: vi.fn().mockResolvedValue(baseConfig),
				saveConfig,
				discoverServer: vi.fn().mockResolvedValue(null),
				printReceipt: vi.fn(),
				logEvent: vi.fn(),
			},
			configurable: true,
			writable: true,
		});

		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				json: vi.fn().mockResolvedValue({ ok: true }),
			}),
		);

		await act(async () => {
			root.render(<ServerConfig onConnected={onConnected} />);
		});

		await act(async () => {
			await Promise.resolve();
		});
	});

	afterEach(async () => {
		await act(async () => {
			root.unmount();
		});
		container.remove();
		window.electronAPI = undefined;
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it("renders the shortened printer copy without the optional suffix", () => {
		const printerLabel = container.querySelector('label[for="printer-ip"]');
		if (!(printerLabel instanceof HTMLLabelElement)) {
			throw new Error("Printer label not found");
		}

		const text = normalizeText(container.textContent);

		expect(normalizeText(printerLabel.textContent)).toBe("Yazıcı IP Adresi");
		expect(text).toContain("Boşsa fiş yazdırılmaz");
		expect(text).toContain("Önerilen: 61 + cp857. Türkçe bozulursa 24 + cp1254.");
		expect(text).not.toContain("(opsiyonel)");
		expect(text).not.toContain(
			"Varsayılan: cp857 + 61. Türkçe karakter bozuksa alternatif olarak cp1254 + 24 deneyin.",
		);
	});

	it("keeps the connect flow unchanged after the copy update", async () => {
		const connectButton = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent === "Bağlan",
		);
		if (!(connectButton instanceof HTMLButtonElement)) {
			throw new Error("Connect button not found");
		}

		await act(async () => {
			connectButton.click();
		});

		expect(globalThis.fetch).toHaveBeenCalledWith("http://sepetarasi.local:3000/health");
		expect(setBaseUrl).toHaveBeenCalledWith("http://sepetarasi.local:3000");
		expect(setTerminalId).toHaveBeenCalledWith("KASA-1");
		expect(setCashierToken).toHaveBeenCalledWith("cashier-secret");
		expect(saveConfig).toHaveBeenCalledWith(baseConfig);
		expect(onConnected).toHaveBeenCalledTimes(1);
	});
});
