import type { DayStats, Order } from "@sepetarasi/shared";

const baseUrl = "";

async function request<T>(method: string, path: string): Promise<T> {
	const res = await fetch(`${baseUrl}${path}`, { method });
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
};
