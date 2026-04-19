/** @vitest-environment jsdom */

import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServerConfig } from "../src/components/ServerConfig";
import {
	ApiError,
	setBaseUrl,
	setCashierToken,
	setTerminalId,
	verifyCashierToken,
} from "../src/lib/api";

vi.mock("../src/lib/api", () => ({
	ApiError: class ApiError extends Error {
		code: string;
		statusCode: number;

		constructor(code: string, message: string, statusCode: number) {
			super(message);
			this.name = "ApiError";
			this.code = code;
			this.statusCode = statusCode;
		}
	},
	getBaseUrl: vi.fn(() => "http://localhost:3000"),
	setBaseUrl: vi.fn(),
	setTerminalId: vi.fn(),
	setCashierToken: vi.fn(),
	verifyCashierToken: vi.fn(),
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
	cashierTokensByServerUrl: {
		"http://localhost:3000": "local-dev-cashier-token",
		"http://sepetarasi.local:3000": "cashier-secret",
	},
};

function normalizeText(value: string | null | undefined) {
	return value?.replace(/\s+/g, " ").trim() ?? "";
}

async function click(element: HTMLElement) {
	await act(async () => {
		element.click();
	});
}

async function changeInputValue(input: HTMLInputElement, value: string) {
	const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
	if (!setter) {
		throw new Error("HTMLInputElement value setter not found");
	}

	await act(async () => {
		setter.call(input, value);
		input.dispatchEvent(new Event("input", { bubbles: true }));
	});
}

function getButton(container: HTMLDivElement, label: string) {
	const button = Array.from(container.querySelectorAll("button")).find(
		(node) => normalizeText(node.textContent) === label,
	);
	if (!(button instanceof HTMLButtonElement)) {
		throw new Error(`Button not found: ${label}`);
	}
	return button;
}

describe("ServerConfig", () => {
	let container: HTMLDivElement;
	let root: Root;
	let onConnected: ReturnType<typeof vi.fn>;
	let saveConfig: ReturnType<typeof vi.fn>;
	let getConfig: ReturnType<typeof vi.fn>;

	async function render(config = baseConfig) {
		getConfig.mockResolvedValue(config);

		await act(async () => {
			root.render(<ServerConfig onConnected={onConnected} />);
		});

		await act(async () => {
			await Promise.resolve();
		});
	}

	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		onConnected = vi.fn();
		saveConfig = vi.fn().mockResolvedValue(true);
		getConfig = vi.fn();

		Object.defineProperty(window, "electronAPI", {
			value: {
				getConfig,
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

		vi.mocked(verifyCashierToken).mockResolvedValue(null);
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

	it("renders the shortened printer copy without the optional suffix", async () => {
		await render();

		const printerLabel = container.querySelector('label[for="printer-ip"]');
		if (!(printerLabel instanceof HTMLLabelElement)) {
			throw new Error("Printer label not found");
		}

		const text = normalizeText(container.textContent);

		expect(normalizeText(printerLabel.textContent)).toBe("Yazıcı IP Adresi");
		expect(text).toContain("Boşsa fiş yazdırılmaz");
		expect(text).toContain("Önerilen ayar: 61 ve cp857. Türkçe bozulursa 24 ve cp1254 deneyin.");
		expect(text).not.toContain("(opsiyonel)");
		expect(text).not.toContain(
			"Varsayılan: cp857 + 61. Türkçe karakter bozuksa alternatif olarak cp1254 + 24 deneyin.",
		);
	});

	it("hides the token field for localhost and uses the local dev token automatically", async () => {
		await render({
			...baseConfig,
			serverUrl: "http://localhost:3000",
			cashierToken: "local-dev-cashier-token",
		});

		expect(container.querySelector("#cashier-token")).toBeNull();
		expect(container.textContent).not.toContain("Kasiyer token:");

		await click(getButton(container, "Bağlan"));

		expect(globalThis.fetch).toHaveBeenCalledWith("http://localhost:3000/health");
		expect(verifyCashierToken).toHaveBeenCalledWith(
			"http://localhost:3000",
			"local-dev-cashier-token",
		);
		expect(setBaseUrl).toHaveBeenCalledWith("http://localhost:3000");
		expect(setTerminalId).toHaveBeenCalledWith("KASA-1");
		expect(setCashierToken).toHaveBeenCalledWith("local-dev-cashier-token");
		expect(saveConfig).toHaveBeenCalledWith({
			...baseConfig,
			serverUrl: "http://localhost:3000",
			cashierToken: "local-dev-cashier-token",
		});
		expect(onConnected).toHaveBeenCalledTimes(1);
	});

	it("keeps the prod token field hidden until Token Değiştir is pressed", async () => {
		await render();

		expect(container.querySelector("#cashier-token")).toBeNull();
		expect(container.textContent).toContain("Kasiyer token: kayıtlı");
		expect(container.textContent).toContain("Gelişmiş");
		expect(container.textContent).toContain("Token Değiştir");
	});

	it("reveals a masked prod token input after Token Değiştir", async () => {
		await render();

		await click(getButton(container, "Token Değiştir"));

		const tokenInput = container.querySelector("#cashier-token");
		if (!(tokenInput instanceof HTMLInputElement)) {
			throw new Error("Cashier token input not found");
		}

		expect(tokenInput.type).toBe("password");
		expect(tokenInput.value).toBe("");
		expect(tokenInput.placeholder).toBe("Boş bırakırsan mevcut token korunur");
		expect(container.textContent).toContain(
			"Alanı boş bırakırsan mevcut doğrulanmış token korunur.",
		);
	});

	it("does not save or connect when a new prod token verification fails", async () => {
		vi.mocked(verifyCashierToken).mockRejectedValue(
			new ApiError("UNAUTHORIZED", "Kasiyer token doğrulanamadı.", 401),
		);
		await render();

		await click(getButton(container, "Token Değiştir"));

		const tokenInput = container.querySelector("#cashier-token");
		if (!(tokenInput instanceof HTMLInputElement)) {
			throw new Error("Cashier token input not found");
		}

		await changeInputValue(tokenInput, "wrong-token");
		await click(getButton(container, "Bağlan"));

		expect(verifyCashierToken).toHaveBeenCalledWith("http://sepetarasi.local:3000", "wrong-token");
		expect(saveConfig).not.toHaveBeenCalled();
		expect(onConnected).not.toHaveBeenCalled();
		expect(container.textContent).toContain("Kasiyer token doğrulanamadı. Token'ı kontrol edin.");
		expect(container.textContent).toContain("Kasiyer token: kayıtlı");
	});

	it("keeps the stored prod token when the token editor stays blank", async () => {
		await render();

		await click(getButton(container, "Token Değiştir"));
		await click(getButton(container, "Bağlan"));

		expect(globalThis.fetch).toHaveBeenCalledWith("http://sepetarasi.local:3000/health");
		expect(verifyCashierToken).toHaveBeenCalledWith(
			"http://sepetarasi.local:3000",
			"cashier-secret",
		);
		expect(setBaseUrl).toHaveBeenCalledWith("http://sepetarasi.local:3000");
		expect(setTerminalId).toHaveBeenCalledWith("KASA-1");
		expect(setCashierToken).toHaveBeenCalledWith("cashier-secret");
		expect(saveConfig).toHaveBeenCalledWith(baseConfig);
		expect(onConnected).toHaveBeenCalledTimes(1);
	});

	it("restores the saved prod token when the URL changes from localhost to prod", async () => {
		await render({
			...baseConfig,
			serverUrl: "http://localhost:3000",
			cashierToken: "local-dev-cashier-token",
		});

		const serverUrlInput = container.querySelector("#server-url");
		if (!(serverUrlInput instanceof HTMLInputElement)) {
			throw new Error("Server URL input not found");
		}

		await changeInputValue(serverUrlInput, "http://sepetarasi.local:3000");

		expect(container.textContent).toContain("Kasiyer token: kayıtlı");

		await click(getButton(container, "Token Değiştir"));

		const tokenInput = container.querySelector("#cashier-token");
		if (!(tokenInput instanceof HTMLInputElement)) {
			throw new Error("Cashier token input not found");
		}

		expect(tokenInput.value).toBe("");
		expect(tokenInput.placeholder).toBe("Boş bırakırsan mevcut token korunur");
	});

	it("uses the remembered prod token after switching back from localhost", async () => {
		await render({
			...baseConfig,
			serverUrl: "http://localhost:3000",
			cashierToken: "local-dev-cashier-token",
		});

		const serverUrlInput = container.querySelector("#server-url");
		if (!(serverUrlInput instanceof HTMLInputElement)) {
			throw new Error("Server URL input not found");
		}

		await changeInputValue(serverUrlInput, "http://sepetarasi.local:3000");
		await click(getButton(container, "Bağlan"));

		expect(verifyCashierToken).toHaveBeenCalledWith(
			"http://sepetarasi.local:3000",
			"cashier-secret",
		);
		expect(saveConfig).toHaveBeenCalledWith({
			...baseConfig,
			serverUrl: "http://sepetarasi.local:3000",
			cashierToken: "cashier-secret",
		});
		expect(onConnected).toHaveBeenCalledTimes(1);
	});

	it("clears a draft token when switching between prod URLs", async () => {
		await render();

		await click(getButton(container, "Token Değiştir"));

		const tokenInput = container.querySelector("#cashier-token");
		const serverUrlInput = container.querySelector("#server-url");
		if (!(tokenInput instanceof HTMLInputElement)) {
			throw new Error("Cashier token input not found");
		}
		if (!(serverUrlInput instanceof HTMLInputElement)) {
			throw new Error("Server URL input not found");
		}

		await changeInputValue(tokenInput, "partial-token");
		await changeInputValue(serverUrlInput, "http://10.0.0.5:3000");

		expect(tokenInput.value).toBe("");
		expect(container.textContent).toContain("Kasiyer token: gerekli");
		expect(tokenInput.placeholder).toBe("Yeni kasiyer token'ı");
	});
});
