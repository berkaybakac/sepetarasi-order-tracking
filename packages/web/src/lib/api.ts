// ADR: intentionally separate from kasa/api.ts — see docs/dev-notes.md "Intentional Separations"
import { API_ROUTES } from "@sepetarasi/shared";
import type { DayStats, Order } from "@sepetarasi/shared";

const baseUrl = "";
const cashierToken = import.meta.env.VITE_CASHIER_TOKEN?.trim();
const resolvedCashierToken =
	cashierToken || (import.meta.env.DEV ? "local-dev-cashier-token" : undefined);

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
	const headers: Record<string, string> = {};
	if (resolvedCashierToken) {
		headers["x-cashier-token"] = resolvedCashierToken;
	}
	if (body) {
		headers["Content-Type"] = "application/json";
	}

	const res = await fetch(`${baseUrl}${path}`, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined,
		credentials: "include", // Send auth cookies
	});

	if (res.status === 429) {
		throw new Error("Çok fazla deneme. 1 dakika bekleyin.");
	}

	const json = await res.json();
	if (!json.ok) {
		throw new Error(json.error?.message || "Bilinmeyen bir hata oluştu.");
	}
	return json.data;
}

export const api = {
	listOrders: (businessDate?: string) => {
		const params = businessDate ? `?business_date=${businessDate}` : "";
		return request<Order[]>("GET", `${API_ROUTES.V1.ORDERS}${params}`);
	},
	getStats: () => request<DayStats>("GET", API_ROUTES.V1.STATS_TODAY),
	getStatsByPeriod: (period: "daily" | "weekly" | "monthly") =>
		request<DayStats>("GET", `${API_ROUTES.V1.STATS}?period=${period}`),
	getSettings: () => request<Record<string, string>>("GET", API_ROUTES.V1.SETTINGS),
	getPublicSettings: () => request<Record<string, string>>("GET", API_ROUTES.V1.SETTINGS_PUBLIC),
	updateSettingsBulk: (settings: Record<string, string>) =>
		request<null>("PATCH", API_ROUTES.V1.SETTINGS_BULK, { settings }),
	updateSetting: (key: string, value: string) =>
		request<null>("PATCH", API_ROUTES.V1.SETTING_BY_KEY(key), { value }),
	deleteOrder: (id: string) => request<null>("DELETE", `${API_ROUTES.V1.ORDERS}/${id}`),
	authLogin: (password: string) => request<null>("POST", API_ROUTES.V1.AUTH.LOGIN, { password }),
	authLogout: () => request<null>("POST", API_ROUTES.V1.AUTH.LOGOUT),
	authCheck: () => request<{ role: string }>("GET", API_ROUTES.V1.AUTH.ME),
	authChangePassword: (currentPassword: string, newPassword: string) =>
		request<null>("POST", API_ROUTES.V1.AUTH.CHANGE_PASSWORD, { currentPassword, newPassword }),
};
