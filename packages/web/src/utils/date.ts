/**
 * Zamana dair utilities fonksiyonlar - Single Source of Truth
 */

import { UI_LABELS } from "../constants/labels";

/**
 * Verilen ISO tarih stringinden bugüne/şimdiye kadar geçen süreyi
 * dakika cinsinden insan okunur bir metin ("<1 dk" veya "5 dk") olarak döndürür.
 */
export function timeSince(dateStr: string): string {
	const diff = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diff / 60000);

	if (mins < 1) return UI_LABELS.ORDERS.LESS_THAN_A_MINUTE;
	return `${mins} ${UI_LABELS.ORDERS.MINUTES_SHORT}`;
}

/**
 * Siparişin kalan zamanını hesaplar.
 * Varsayılan hedef 20 dakikadır.
 */
export function getOrderTimer(createdAtStr: string, targetMinutes = 20) {
	const elapsedMs = Date.now() - new Date(createdAtStr).getTime();
	const elapsedMins = Math.floor(elapsedMs / 60000);
	const remainingMins = targetMinutes - elapsedMins;

	const isUrgent = remainingMins <= 2 && remainingMins >= 0;
	const isOverdue = remainingMins < 0;

	return {
		elapsedMins,
		remainingMins,
		isUrgent,
		isOverdue,
		formatted: isOverdue ? `Gecikti (${Math.abs(remainingMins)} dk)` : `${remainingMins} dk kaldı`,
	};
}

function getUnixMs(dateStr: string | null | undefined): number | null {
	if (!dateStr) return null;
	const ms = new Date(dateStr).getTime();
	return Number.isFinite(ms) ? ms : null;
}

export function formatFixedDurationMs(durationMs: number): string {
	const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));

	if (totalSeconds < 60) {
		return `${totalSeconds} ${UI_LABELS.ORDERS.SECONDS_SHORT}`;
	}

	if (totalSeconds < 3600) {
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes} ${UI_LABELS.ORDERS.MINUTES_SHORT} ${String(seconds).padStart(2, "0")} ${UI_LABELS.ORDERS.SECONDS_SHORT}`;
	}

	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	return `${hours} ${UI_LABELS.ORDERS.HOURS_SHORT} ${String(minutes).padStart(2, "0")} ${UI_LABELS.ORDERS.MINUTES_SHORT}`;
}

export function getDeliveredOrderDurationLabel(
	createdAtStr: string,
	deliveredAtStr: string | null | undefined,
	fallbackEndAtStr?: string | null,
): string {
	const startMs = getUnixMs(createdAtStr);
	const endMs = getUnixMs(deliveredAtStr) ?? getUnixMs(fallbackEndAtStr) ?? startMs;

	if (startMs == null || endMs == null) {
		return `0 ${UI_LABELS.ORDERS.SECONDS_SHORT}`;
	}

	return formatFixedDurationMs(Math.max(0, endMs - startMs));
}

export function formatAverageDeliveryMinutes(averageDeliverySeconds: number | null): string | null {
	if (averageDeliverySeconds == null) return null;

	const roundedMinutes = Math.round((averageDeliverySeconds / 60) * 10) / 10;
	const fixed = roundedMinutes.toFixed(1);
	return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
}
