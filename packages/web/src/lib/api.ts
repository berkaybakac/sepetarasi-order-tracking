// ADR: intentionally separate from kasa/api.ts — see docs/dev-notes.md "Intentional Separations"
import { API_ROUTES } from "@sepetarasi/shared";
import type { DayStats, MusicStatus, MusicTrack, Order } from "@sepetarasi/shared";

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

	let json: { ok: boolean; data?: T; error?: { message?: string } };
	try {
		json = await res.json();
	} catch {
		// Non-JSON response (e.g. 502 proxy error, nginx error page)
		throw new Error(
			res.ok ? "Sunucu yanıtı okunamadı." : `Sunucuya ulaşılamıyor (HTTP ${res.status}).`,
		);
	}
	if (!json.ok) {
		throw new Error(json.error?.message || "Bilinmeyen bir hata oluştu.");
	}
	return json.data as T;
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
		request<null>("PATCH", `/api/v1/music/tracks/${id}`, patch),
	musicPlay: () => request<null>("POST", "/api/v1/music/play"),
	musicPause: () => request<null>("POST", "/api/v1/music/pause"),
	musicSkip: () => request<null>("POST", "/api/v1/music/skip"),
	musicPrevious: () => request<null>("POST", "/api/v1/music/previous"),
	setMusicVolume: (volume: number) => request<null>("PATCH", "/api/v1/music/volume", { volume }),
	setMusicEnabled: (enabled: boolean) =>
		request<null>("PATCH", "/api/v1/music/enabled", { enabled }),
	setMusicMode: (mode: { loop?: boolean; shuffle?: boolean }) =>
		request<null>("PATCH", "/api/v1/music/mode", mode),

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
					reject(new Error("Çok fazla deneme. 1 dakika bekleyin."));
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
