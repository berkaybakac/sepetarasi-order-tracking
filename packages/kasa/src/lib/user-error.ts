import { ApiError } from "./api";

const TECHNICAL_MESSAGE_PATTERNS = [
	/\bHTTP\s*\d{3}\b/i,
	/\bRequest failed\b/i,
	/\bInvalid\b/i,
	/\bDuplicate\b/i,
	/\bOrder not found\b/i,
	/\bNot logged in\b/i,
	/\bmust be\b/i,
	/\bUnknown\b/i,
];

function isTechnicalMessage(message: string) {
	const trimmed = message.trim();
	if (!trimmed) return true;
	return TECHNICAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function getUserErrorMessage(error: unknown, fallback: string) {
	if (error instanceof ApiError) {
		switch (error.code) {
			case "NETWORK_ERROR":
				return "Bağlantı kurulamadı. Ağ bağlantısını kontrol edin.";
			case "INVALID_RESPONSE":
				return fallback;
			default:
				break;
		}

		if (error.message && !isTechnicalMessage(error.message)) {
			return error.message.trim();
		}

		return fallback;
	}

	if (error instanceof Error && error.message && !isTechnicalMessage(error.message)) {
		return error.message.trim();
	}

	return fallback;
}
