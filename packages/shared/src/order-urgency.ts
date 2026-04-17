import { DELIVERY_WARNING_BUFFER_MINUTES } from "./constants.js";

export type OrderUrgency = "normal" | "warning" | "overdue";

/**
 * Sipariş başına geçen süre ile hedef süreyi karşılaştırıp aciliyet durumunu döner.
 * Hem admin kartları hem kasa kartları hem analytics "hedefte" metriği aynı kuralı kullanır.
 */
export function getOrderUrgency(
	elapsedMinutes: number,
	targetMinutes: number,
	bufferMinutes: number = DELIVERY_WARNING_BUFFER_MINUTES,
): OrderUrgency {
	if (!Number.isFinite(elapsedMinutes) || !Number.isFinite(targetMinutes) || targetMinutes <= 0) {
		return "normal";
	}
	if (elapsedMinutes >= targetMinutes) return "overdue";
	if (elapsedMinutes >= targetMinutes - bufferMinutes) return "warning";
	return "normal";
}
