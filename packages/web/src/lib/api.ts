// ADR: intentionally separate from kasa/api.ts — see docs/dev-notes.md "Intentional Separations"
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
		return request<Order[]>("GET", `/api/v1/orders${params}`);
	},
	getStats: () => request<DayStats>("GET", "/api/v1/stats/today"),
	getStatsByPeriod: (period: "daily" | "weekly" | "monthly") =>
		request<DayStats>("GET", `/api/v1/stats?period=${period}`),
	getSettings: () => request<Record<string, string>>("GET", "/api/v1/settings"),
	updateSetting: (key: string, value: string) =>
		request<null>("PATCH", `/api/v1/settings/${key}`, { value }),
};
