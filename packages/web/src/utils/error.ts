import { ApiError } from "../lib/api";

const TECHNICAL_MESSAGE_PATTERNS = [
	/\bHTTP\s*\d{3}\b/i,
	/\b(?:API_ERROR|INVALID_[A-Z_]+|NETWORK_ERROR|TIMEOUT|ABORTED)\b/,
	/\bmust be\b/i,
	/\bUnknown\b/i,
	/\bInvalid\b/i,
	/\bDuplicate\b/i,
	/\bRequest failed\b/i,
	/\bRoute not found\b/i,
	/\bOrder not found\b/i,
	/\bNot logged in\b/i,
	/\bCurrent password\b/i,
	/\bAdmin access required\b/i,
	/\bCashier token\b/i,
	/\bdisplay_[a-z_]+\b/i,
	/\bdelivery_target_[a-z_]+\b/i,
	/\brestaurant_name\b/i,
];

function isTechnicalMessage(message: string) {
	const trimmed = message.trim();
	if (!trimmed) return true;
	return TECHNICAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function mapApiErrorMessage(error: ApiError): string | null {
	switch (error.code) {
		case "NETWORK_ERROR":
			return "Bağlantı kurulamadı. Lütfen bağlantınızı kontrol edin.";
		case "TIMEOUT":
			return "İşlem zamanında tamamlanamadı. Lütfen tekrar deneyin.";
		case "ABORTED":
			return null;
		case "HTTP_ERROR":
		case "INVALID_RESPONSE":
		case "UNAUTHORIZED":
			return null;
		default:
			return null;
	}
}

export function getErrorMessage(error: unknown, fallback: string) {
	if (error instanceof ApiError) {
		const mappedMessage = mapApiErrorMessage(error);
		if (mappedMessage) return mappedMessage;
		if (error.message && !isTechnicalMessage(error.message)) {
			return error.message.trim();
		}
		return fallback;
	}

	if (error instanceof Error && error.message) {
		if (!isTechnicalMessage(error.message)) {
			return error.message.trim();
		}
	}

	return fallback;
}
