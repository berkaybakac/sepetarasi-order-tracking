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
