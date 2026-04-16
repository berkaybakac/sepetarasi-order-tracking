// ADR: intentionally separate from web/api.ts — see docs/dev-notes.md "Intentional Separations"
import { API_ROUTES } from "@sepetarasi/shared";
import type { CreateOrderInput, Order, UpdateStatusInput } from "@sepetarasi/shared";

let baseUrl = "http://localhost:3000";
let terminalId = "";
let cashierToken = "local-dev-cashier-token";

export function setBaseUrl(url: string) {
	baseUrl = url.replace(/\/$/, "");
}

export function getBaseUrl() {
	return baseUrl;
}

export function setTerminalId(id: string) {
	terminalId = id;
}

export function getTerminalId() {
	return terminalId;
}

export function setCashierToken(token: string) {
	cashierToken = token;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
	const res = await fetch(`${baseUrl}${path}`, {
		method,
		headers: {
			...(body ? { "Content-Type": "application/json" } : {}),
			...(cashierToken ? { "x-cashier-token": cashierToken } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
	});

	const contentType = res.headers.get("content-type") || "";
	const json = contentType.includes("application/json") ? await res.json() : null;

	if (!res.ok) {
		const code = json?.error?.code ?? json?.code ?? `HTTP_${res.status}`;
		const message = json?.error?.message ?? json?.message ?? `Request failed (${res.status})`;
		throw new ApiError(code, message, res.status);
	}

	if (json?.ok === false) {
		const code = json?.error?.code ?? `HTTP_${res.status}`;
		const message = json?.error?.message ?? "Request failed";
		throw new ApiError(code, message, res.status);
	}

	if (json?.ok === true) {
		return json.data as T;
	}

	return json as T;
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
	createOrder: (input: CreateOrderInput) =>
		request<Order>("POST", API_ROUTES.V1.ORDERS, {
			...input,
			...(terminalId ? { terminal_id: terminalId } : {}),
		}),

	listOrders: (businessDate?: string) => {
		const params = businessDate ? `?business_date=${businessDate}` : "";
		return request<Order[]>("GET", `${API_ROUTES.V1.ORDERS}${params}`);
	},

	changeStatus: (orderId: string, input: UpdateStatusInput) =>
		request<Order>("PATCH", API_ROUTES.V1.ORDER_STATUS(orderId), input),

	getPublicSettings: () => request<Record<string, string>>("GET", API_ROUTES.V1.SETTINGS_PUBLIC),
};
