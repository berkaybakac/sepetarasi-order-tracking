// ADR: intentionally separate from kasa/api.ts — see docs/dev-notes.md "Intentional Separations"
import { API_ROUTES } from "@sepetarasi/shared";
import type { DayStats, Order } from "@sepetarasi/shared";

const baseUrl = "";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
	const res = await fetch(`${baseUrl}${path}`, {
		method,
		headers: body ? { "Content-Type": "application/json" } : undefined,
		body: body ? JSON.stringify(body) : undefined,
	});
	const json = await res.json();
	if (!json.ok) throw new Error(json.error.message);
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
	updateSetting: (key: string, value: string) =>
		request<null>("PATCH", API_ROUTES.V1.SETTING_BY_KEY(key), { value }),
};
