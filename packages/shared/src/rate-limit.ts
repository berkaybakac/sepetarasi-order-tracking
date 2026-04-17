/**
 * Rate limit helpers (SSoT) — paylaşılan client/server implementasyonu.
 *
 * - parseRetryAfterSeconds RFC 7231 retry-after header'ının üç varyantını da çözer:
 *   saniye sayısı (string ya da number), HTTP-date string, veya ilkini alır (array).
 * - formatRateLimitMessage 60 saniye eşiğiyle Türkçe kullanıcı mesajı üretir.
 */

export function parseRetryAfterSeconds(value: unknown): number | undefined {
	if (Array.isArray(value)) {
		return parseRetryAfterSeconds(value[0]);
	}

	if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
		return Math.trunc(value);
	}

	if (typeof value !== "string" || value.length === 0) return undefined;

	const numeric = Number.parseInt(value, 10);
	if (Number.isFinite(numeric) && numeric >= 0) {
		return numeric;
	}

	const dateValue = Date.parse(value);
	if (Number.isNaN(dateValue)) return undefined;

	return Math.max(1, Math.ceil((dateValue - Date.now()) / 1000));
}

export function formatRateLimitMessage(retryAfterSeconds?: number): string {
	if (!retryAfterSeconds || retryAfterSeconds <= 0) {
		return "İstek sınırına ulaşıldı. Kısa süre sonra tekrar deneyin.";
	}

	if (retryAfterSeconds < 60) {
		return `İstek sınırına ulaşıldı. Yaklaşık ${retryAfterSeconds} sn sonra tekrar deneyin.`;
	}

	const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
	return `İstek sınırına ulaşıldı. Yaklaşık ${minutes} dk sonra tekrar deneyin.`;
}
