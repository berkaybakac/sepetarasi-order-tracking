// ADR: intentionally separate from web/api.ts — see docs/dev-notes.md "Intentional Separations"
import { API_ROUTES } from "@sepetarasi/shared";
import type { CreateOrderInput, Order, UpdateStatusInput } from "@sepetarasi/shared";
import {
	LOCAL_DEV_CASHIER_TOKEN,
	LOCAL_DEV_SERVER_URL,
	normalizeServerUrl,
} from "./connection-config";

let baseUrl = LOCAL_DEV_SERVER_URL;
let terminalId = "";
let cashierToken = LOCAL_DEV_CASHIER_TOKEN;

export function setBaseUrl(url: string) {
	baseUrl = normalizeServerUrl(url);
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

async function requestAtUrl<T>(
	requestBaseUrl: string,
	method: string,
	path: string,
	body?: unknown,
	tokenOverride?: string,
): Promise<T> {
	let res: Response;
	try {
		res = await fetch(`${normalizeServerUrl(requestBaseUrl)}${path}`, {
			method,
			headers: {
				...(body ? { "Content-Type": "application/json" } : {}),
				...(tokenOverride ? { "x-cashier-token": tokenOverride } : {}),
			},
			body: body ? JSON.stringify(body) : undefined,
		});
	} catch {
		throw new ApiError("NETWORK_ERROR", "Bağlantı kurulamadı. Ağ bağlantısını kontrol edin.", 0);
	}

	const contentType = res.headers.get("content-type") || "";
	let json: unknown = null;
	if (contentType.includes("application/json")) {
		try {
			json = await res.json();
		} catch {
			if (res.ok) {
				throw new ApiError("INVALID_RESPONSE", "Sunucudan geçerli yanıt alınamadı.", res.status);
			}
		}
	}

	if (!res.ok) {
		const apiResponse = json as {
			error?: { code?: string; message?: string };
			code?: string;
			message?: string;
		} | null;
		const code = apiResponse?.error?.code ?? apiResponse?.code ?? `HTTP_${res.status}`;
		const message =
			apiResponse?.error?.message ??
			apiResponse?.message ??
			(res.status >= 500
				? "Sunucuda geçici bir sorun oluştu. Lütfen tekrar deneyin."
				: "İşlem tamamlanamadı.");
		throw new ApiError(code, message, res.status);
	}

	const apiResponse = json as {
		ok?: boolean;
		data?: T;
		error?: { code?: string; message?: string };
	} | null;

	if (apiResponse?.ok === false) {
		const code = apiResponse.error?.code ?? `HTTP_${res.status}`;
		const message = apiResponse.error?.message ?? "İşlem tamamlanamadı.";
		throw new ApiError(code, message, res.status);
	}

	if (apiResponse?.ok === true) {
		return apiResponse.data as T;
	}

	if (json !== null) {
		return json as T;
	}

	throw new ApiError("INVALID_RESPONSE", "Sunucudan geçerli yanıt alınamadı.", res.status);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
	return requestAtUrl<T>(baseUrl, method, path, body, cashierToken);
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

	verifyAdminPassword: (password: string) =>
		request<null>("POST", API_ROUTES.V1.AUTH.VERIFY_PASSWORD, { password }),
};

export function verifyCashierToken(serverUrl: string, token: string) {
	return requestAtUrl<null>(
		serverUrl,
		"GET",
		API_ROUTES.V1.AUTH.VERIFY_CASHIER_TOKEN,
		undefined,
		token,
	);
}
