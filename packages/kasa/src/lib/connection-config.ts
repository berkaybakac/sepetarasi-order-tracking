export const LOCAL_DEV_SERVER_URL = "http://localhost:3000";
export const LOCAL_DEV_CASHIER_TOKEN = "local-dev-cashier-token";
export type CashierTokensByServerUrl = Record<string, string>;

export function normalizeServerUrl(url: string): string {
	return url.trim().replace(/\/+$/, "");
}

export function isLocalDevServerUrl(url: string): boolean {
	return normalizeServerUrl(url) === LOCAL_DEV_SERVER_URL;
}

export function getEffectiveCashierToken(serverUrl: string, cashierToken: string): string {
	if (isLocalDevServerUrl(serverUrl)) {
		return LOCAL_DEV_CASHIER_TOKEN;
	}

	return cashierToken.trim();
}

export function normalizeCashierTokensByServerUrl(value: unknown): CashierTokensByServerUrl {
	const normalized: CashierTokensByServerUrl = {
		[LOCAL_DEV_SERVER_URL]: LOCAL_DEV_CASHIER_TOKEN,
	};

	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return normalized;
	}

	for (const [rawUrl, rawToken] of Object.entries(value)) {
		if (typeof rawToken !== "string") continue;
		const normalizedUrl = normalizeServerUrl(rawUrl);
		const normalizedToken = rawToken.trim();
		if (!normalizedUrl || !normalizedToken) continue;
		normalized[normalizedUrl] = normalizedToken;
	}

	return normalized;
}

export function getSavedCashierTokenForServerUrl(
	serverUrl: string,
	cashierTokensByServerUrl: CashierTokensByServerUrl,
	fallbackCashierToken = "",
): string {
	const normalizedUrl = normalizeServerUrl(serverUrl);
	if (normalizedUrl && cashierTokensByServerUrl[normalizedUrl]) {
		return cashierTokensByServerUrl[normalizedUrl];
	}

	return fallbackCashierToken.trim();
}

export function upsertCashierTokenForServerUrl(
	cashierTokensByServerUrl: CashierTokensByServerUrl,
	serverUrl: string,
	cashierToken: string,
): CashierTokensByServerUrl {
	const normalizedUrl = normalizeServerUrl(serverUrl);
	const normalizedToken = cashierToken.trim();
	if (!normalizedUrl || !normalizedToken) {
		return { ...cashierTokensByServerUrl };
	}

	return {
		...cashierTokensByServerUrl,
		[normalizedUrl]: normalizedToken,
	};
}
