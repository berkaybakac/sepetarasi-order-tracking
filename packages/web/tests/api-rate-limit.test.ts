/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/lib/api";

describe("api rate-limit handling", () => {
	afterEach(() => {
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
});
