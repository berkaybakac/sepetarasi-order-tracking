/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/lib/api";

class MockXMLHttpRequest {
	static lastInstance: MockXMLHttpRequest | null = null;

	method: string | null = null;
	url: string | null = null;
	requestBody: string | undefined;
	timeout = 0;
	withCredentials = false;
	responseText = "";
	status = 0;
	upload = { onprogress: null as ((event: ProgressEvent<EventTarget>) => void) | null };

	private responseHeaders = new Map<string, string>();

	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;
	onabort: (() => void) | null = null;
	ontimeout: (() => void) | null = null;

	constructor() {
		MockXMLHttpRequest.lastInstance = this;
	}

	open(method: string, url: string) {
		this.method = method;
		this.url = url;
	}

	setRequestHeader(_name: string, _value: string) {}

	getResponseHeader(name: string) {
		return this.responseHeaders.get(name.toLowerCase()) ?? null;
	}

	send(body?: string) {
		this.requestBody = body;
	}

	abort() {
		this.onabort?.();
	}

	respond(status: number, body: string, headers: Record<string, string> = {}) {
		this.status = status;
		this.responseText = body;
		this.responseHeaders = new Map(
			Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
		);
		this.onload?.();
	}

	timeoutRequest() {
		this.ontimeout?.();
	}
}

describe("api rate-limit handling", () => {
	const originalFetch = globalThis.fetch;
	const originalAbortController = globalThis.AbortController;
	const originalXmlHttpRequest = globalThis.XMLHttpRequest;

	afterEach(() => {
		globalThis.fetch = originalFetch;
		globalThis.AbortController = originalAbortController;
		globalThis.XMLHttpRequest = originalXmlHttpRequest;
		MockXMLHttpRequest.lastInstance = null;
		vi.restoreAllMocks();
	});

	it("surfaces retryAfterSeconds and a neutral message for 429 responses", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					ok: false,
					error: {
						message: "İstek sınırına ulaşıldı. Yaklaşık 45 sn sonra tekrar deneyin.",
					},
					retryAfterSeconds: 45,
				}),
				{
					status: 429,
					headers: {
						"content-type": "application/json",
						"retry-after": "45",
					},
				},
			),
		);

		await expect(api.getDeliveryAnalytics("2026-04-10", "2026-04-17")).rejects.toMatchObject({
			name: "ApiError",
			status: 429,
			code: "RATE_LIMITED",
			recoverable: true,
			retryAfterSeconds: 45,
			message: "İstek sınırına ulaşıldı. Yaklaşık 45 sn sonra tekrar deneyin.",
		});
	});

	it("preserves API error codes for non-2xx JSON responses", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					ok: false,
					error: {
						code: "INVALID_CURRENT_PASSWORD",
						message: "Current password is wrong",
					},
				}),
				{
					status: 400,
					headers: {
						"content-type": "application/json",
					},
				},
			),
		);

		await expect(api.authChangePassword("wrong-password", "new-password-1")).rejects.toMatchObject({
			name: "ApiError",
			status: 400,
			code: "INVALID_CURRENT_PASSWORD",
			message: "Current password is wrong",
		});
	});

	it("falls back to XMLHttpRequest when fetch transport is unavailable", async () => {
		globalThis.fetch = undefined as typeof fetch;
		globalThis.AbortController = undefined as typeof AbortController;
		globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;

		const requestPromise = api.listOrders();
		const xhr = MockXMLHttpRequest.lastInstance;
		if (!xhr) {
			throw new Error("XMLHttpRequest fallback was not used");
		}

		expect(xhr.method).toBe("GET");
		expect(xhr.url).toBe("/api/v1/orders");
		expect(xhr.withCredentials).toBe(true);
		expect(xhr.timeout).toBe(12_000);

		xhr.respond(
			200,
			JSON.stringify({
				ok: true,
				data: [],
			}),
		);

		await expect(requestPromise).resolves.toEqual([]);
	});

	it("surfaces XMLHttpRequest timeouts as ApiError", async () => {
		globalThis.fetch = undefined as typeof fetch;
		globalThis.AbortController = undefined as typeof AbortController;
		globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;

		const requestPromise = api.listOrders();
		const xhr = MockXMLHttpRequest.lastInstance;
		if (!xhr) {
			throw new Error("XMLHttpRequest fallback was not used");
		}

		xhr.timeoutRequest();

		await expect(requestPromise).rejects.toMatchObject({
			name: "ApiError",
			code: "TIMEOUT",
			recoverable: true,
		});
	});
});
