import type { Order, CreateOrderInput, UpdateStatusInput, DayStats, ApiResponse } from "@sepetarasi/shared";

let baseUrl = "http://localhost:3000";

export function setBaseUrl(url: string) {
	baseUrl = url.replace(/\/$/, "");
}

export function getBaseUrl() {
	return baseUrl;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
	const res = await fetch(`${baseUrl}${path}`, {
		method,
		headers: body ? { "Content-Type": "application/json" } : undefined,
		body: body ? JSON.stringify(body) : undefined,
	});

	const json = await res.json();

	if (!json.ok) {
		throw new ApiError(json.error.code, json.error.message, res.status);
	}

	return json.data;
}

export class ApiError extends Error {
	constructor(
		public code: string,
		message: string,
		public statusCode: number,
	) {
		super(message);
		this.name = "ApiError";
	}
}

export const api = {
	createOrder: (input: CreateOrderInput) => request<Order>("POST", "/api/v1/orders", input),

	listOrders: (businessDate?: string) => {
		const params = businessDate ? `?business_date=${businessDate}` : "";
		return request<Order[]>("GET", `/api/v1/orders${params}`);
	},

	changeStatus: (orderId: string, input: UpdateStatusInput) =>
		request<Order>("PATCH", `/api/v1/orders/${orderId}/status`, input),

	getStats: () => request<DayStats>("GET", "/api/v1/stats/today"),
};
