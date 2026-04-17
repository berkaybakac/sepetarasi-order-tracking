// ADR: intentionally separate from kasa/api.ts — see docs/dev-notes.md "Intentional Separations"
import { API_ROUTES } from "@sepetarasi/shared";
import type {
	DayStats,
	DeliveryAnalyticsResult,
	MusicStatus,
	MusicTrack,
	Order,
} from "@sepetarasi/shared";

const baseUrl = "";
const cashierToken = import.meta.env.VITE_CASHIER_TOKEN?.trim();
const resolvedCashierToken =
	cashierToken || (import.meta.env.DEV ? "local-dev-cashier-token" : undefined);

interface RequestOptions {
	body?: unknown;
	headers?: Record<string, string>;
	signal?: AbortSignal;
	timeoutMs?: number;
}

interface ApiErrorOptions {
	status?: number;
	code?: string;
	recoverable?: boolean;
	retryAfterSeconds?: number;
}

export class ApiError extends Error {
	status?: number;
	code?: string;
	recoverable: boolean;
	retryAfterSeconds?: number;

	constructor(message: string, options: ApiErrorOptions = {}) {
		super(message);
		this.name = "ApiError";
		this.status = options.status;
		this.code = options.code;
		this.recoverable = options.recoverable ?? false;
		this.retryAfterSeconds = options.retryAfterSeconds;
	}
}

function parseRetryAfterSeconds(value: string | null): number | undefined {
	if (!value) return undefined;

	const numeric = Number.parseInt(value, 10);
	if (Number.isFinite(numeric) && numeric >= 0) {
		return numeric;
	}

	const dateValue = Date.parse(value);
	if (Number.isNaN(dateValue)) return undefined;

	return Math.max(1, Math.ceil((dateValue - Date.now()) / 1000));
}

function formatRateLimitMessage(retryAfterSeconds?: number): string {
	if (!retryAfterSeconds || retryAfterSeconds <= 0) {
		return "İstek sınırına ulaşıldı. Kısa süre sonra tekrar deneyin.";
	}

	if (retryAfterSeconds < 60) {
		return `İstek sınırına ulaşıldı. Yaklaşık ${retryAfterSeconds} sn sonra tekrar deneyin.`;
	}

	const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
	return `İstek sınırına ulaşıldı. Yaklaşık ${minutes} dk sonra tekrar deneyin.`;
}

async function buildRateLimitError(res: Response): Promise<ApiError> {
	let retryAfterSeconds = parseRetryAfterSeconds(res.headers.get("retry-after"));
	let message = formatRateLimitMessage(retryAfterSeconds);

	try {
		const json = (await res.json()) as {
			error?: { message?: string };
			retryAfterSeconds?: number;
		};
		if (typeof json.retryAfterSeconds === "number" && Number.isFinite(json.retryAfterSeconds)) {
			retryAfterSeconds = json.retryAfterSeconds;
		}
		message =
			json.error?.message && json.error.message.trim().length > 0
				? json.error.message
				: formatRateLimitMessage(retryAfterSeconds);
	} catch {
		message = formatRateLimitMessage(retryAfterSeconds);
	}

	return new ApiError(message, {
		status: 429,
		code: "RATE_LIMITED",
		recoverable: true,
		retryAfterSeconds,
	});
}

function createTimeoutSignal(signal?: AbortSignal, timeoutMs = 12_000) {
	const controller = new AbortController();

	if (signal?.aborted) {
		controller.abort(signal.reason);
		return { signal: controller.signal, cleanup: () => {} };
	}

	const handleAbort = () => controller.abort(signal?.reason);
	const timeoutId = window.setTimeout(
		() => controller.abort(new DOMException("Timed out", "AbortError")),
		timeoutMs,
	);

	signal?.addEventListener("abort", handleAbort);

	return {
		signal: controller.signal,
		cleanup: () => {
			window.clearTimeout(timeoutId);
			signal?.removeEventListener("abort", handleAbort);
		},
	};
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
	const headers: Record<string, string> = {};
	if (resolvedCashierToken) {
		headers["x-cashier-token"] = resolvedCashierToken;
	}
	if (options.body) {
		headers["Content-Type"] = "application/json";
	}
	if (options.headers) {
		Object.assign(headers, options.headers);
	}

	const { signal, cleanup } = createTimeoutSignal(options.signal, options.timeoutMs);

	try {
		const res = await fetch(`${baseUrl}${path}`, {
			method,
			headers,
			body: options.body ? JSON.stringify(options.body) : undefined,
			credentials: "include",
			signal,
		});

		if (res.status === 429) {
			throw await buildRateLimitError(res);
		}

		let json: { ok: boolean; data?: T; error?: { message?: string } } | null = null;
		try {
			json = (await res.json()) as { ok: boolean; data?: T; error?: { message?: string } };
		} catch {
			if (!res.ok) {
				throw new ApiError(`Sunucuya ulaşılamıyor (HTTP ${res.status}).`, {
					status: res.status,
					code: "HTTP_ERROR",
					recoverable: res.status >= 500,
				});
			}
			throw new ApiError("Sunucu yanıtı okunamadı.", {
				status: res.status,
				code: "INVALID_RESPONSE",
			});
		}

		if (!res.ok || !json.ok) {
			throw new ApiError(
				json.error?.message ||
					(res.status >= 500
						? "Sunucu tarafında bir hata oluştu. Lütfen tekrar deneyin."
						: "İstek tamamlanamadı."),
				{
					status: res.status,
					code: "API_ERROR",
					recoverable: res.status >= 500 || res.status === 0,
				},
			);
		}

		return json.data as T;
	} catch (error) {
		if (error instanceof ApiError) throw error;
		if (error instanceof DOMException && error.name === "AbortError") {
			if (options.signal?.aborted) {
				throw new ApiError("İstek iptal edildi.", { code: "ABORTED", recoverable: true });
			}
			throw new ApiError("Sunucu zamanında yanıt vermedi. Lütfen tekrar deneyin.", {
				code: "TIMEOUT",
				recoverable: true,
			});
		}
		throw new ApiError("Ağ hatası. Bağlantınızı kontrol edin.", {
			code: "NETWORK_ERROR",
			recoverable: true,
		});
	} finally {
		cleanup();
	}
}

export const api = {
	listOrders: (businessDate?: string) => {
		const params = businessDate ? `?business_date=${businessDate}` : "";
		return request<Order[]>("GET", `${API_ROUTES.V1.ORDERS}${params}`);
	},
	getStats: () => request<DayStats>("GET", API_ROUTES.V1.STATS_TODAY),
	getStatsByPeriod: (period: "daily" | "weekly" | "monthly") =>
		request<DayStats>("GET", `${API_ROUTES.V1.STATS}?period=${period}`),
	getDeliveryAnalytics: (from: string, to: string) =>
		request<DeliveryAnalyticsResult>(
			"GET",
			`${API_ROUTES.V1.STATS_DELIVERY_ANALYTICS}?from=${from}&to=${to}`,
		),
	getSettings: () => request<Record<string, string>>("GET", API_ROUTES.V1.SETTINGS),
	getPublicSettings: () => request<Record<string, string>>("GET", API_ROUTES.V1.SETTINGS_PUBLIC),
	updateSettingsBulk: (settings: Record<string, string>) =>
		request<null>("PATCH", API_ROUTES.V1.SETTINGS_BULK, { body: { settings } }),
	updateSetting: (key: string, value: string) =>
		request<null>("PATCH", API_ROUTES.V1.SETTING_BY_KEY(key), { body: { value } }),
	deleteOrder: (id: string) => request<null>("DELETE", `${API_ROUTES.V1.ORDERS}/${id}`),
	authLogin: (password: string) =>
		request<null>("POST", API_ROUTES.V1.AUTH.LOGIN, { body: { password } }),
	authLogout: () => request<null>("POST", API_ROUTES.V1.AUTH.LOGOUT),
	authCheck: () => request<{ role: string }>("GET", API_ROUTES.V1.AUTH.ME),
	authChangePassword: (currentPassword: string, newPassword: string) =>
		request<null>("POST", API_ROUTES.V1.AUTH.CHANGE_PASSWORD, {
			body: { currentPassword, newPassword },
		}),

	// Music
	getMusicTracks: () => request<MusicTrack[]>("GET", "/api/v1/music/tracks"),
	getMusicStatus: () => request<MusicStatus>("GET", "/api/v1/music/status"),
	getMusicDisk: () =>
		request<{ totalBytes: number; freeBytes: number; usedBytes: number } | null>(
			"GET",
			"/api/v1/music/disk",
		),
	deleteMusicTrack: (id: string) => request<null>("DELETE", `/api/v1/music/tracks/${id}`),
	updateMusicTrack: (id: string, patch: { display_name?: string; sort_order?: number }) =>
		request<null>("PATCH", `/api/v1/music/tracks/${id}`, { body: patch }),
	musicPlay: () => request<null>("POST", "/api/v1/music/play"),
	musicPause: () => request<null>("POST", "/api/v1/music/pause"),
	musicSkip: () => request<null>("POST", "/api/v1/music/skip"),
	musicPrevious: () => request<null>("POST", "/api/v1/music/previous"),
	setMusicVolume: (volume: number) =>
		request<null>("PATCH", "/api/v1/music/volume", { body: { volume } }),
	setMusicEnabled: (enabled: boolean) =>
		request<null>("PATCH", "/api/v1/music/enabled", { body: { enabled } }),
	setMusicMode: (mode: { loop?: boolean; shuffle?: boolean }) =>
		request<null>("PATCH", "/api/v1/music/mode", { body: mode }),

	uploadMusicTrack: (file: File, onProgress?: (pct: number) => void): Promise<MusicTrack> =>
		new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			const form = new FormData();
			form.append("file", file);

			xhr.upload.onprogress = (e) => {
				if (e.lengthComputable && onProgress) {
					onProgress(Math.round((e.loaded / e.total) * 100));
				}
			};

			xhr.onload = () => {
				if (xhr.status === 429) {
					let retryAfterSeconds = parseRetryAfterSeconds(xhr.getResponseHeader("retry-after"));
					let message = formatRateLimitMessage(retryAfterSeconds);

					try {
						const json = JSON.parse(xhr.responseText) as {
							error?: { message?: string };
							retryAfterSeconds?: number;
						};
						if (
							typeof json.retryAfterSeconds === "number" &&
							Number.isFinite(json.retryAfterSeconds)
						) {
							retryAfterSeconds = json.retryAfterSeconds;
						}
						message =
							json.error?.message && json.error.message.trim().length > 0
								? json.error.message
								: formatRateLimitMessage(retryAfterSeconds);
					} catch {
						message = formatRateLimitMessage(retryAfterSeconds);
					}

					reject(
						new ApiError(message, {
							status: 429,
							code: "RATE_LIMITED",
							recoverable: true,
							retryAfterSeconds,
						}),
					);
					return;
				}
				try {
					const json = JSON.parse(xhr.responseText);
					if (!json.ok) {
						reject(new Error(json.error?.message || "Yükleme başarısız."));
					} else {
						resolve(json.data as MusicTrack);
					}
				} catch {
					reject(new Error("Sunucu yanıtı okunamadı."));
				}
			};

			xhr.onerror = () => reject(new Error("Ağ hatası. Bağlantıyı kontrol edin."));
			xhr.open("POST", "/api/v1/music/tracks");
			xhr.withCredentials = true;
			xhr.send(form);
		}),
};
