export const LOCAL_DEV_SERVER_URL = "http://localhost:3000";
export const LOCAL_DEV_CASHIER_TOKEN = "local-dev-cashier-token";

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
