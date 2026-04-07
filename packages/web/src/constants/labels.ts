import { OrderStatus } from "@sepetarasi/shared";

/**
 * UI Etiketleri (İnsan Okunur Metinler) - Single Source of Truth
 * Uygulamanın metinlerinin tek bir yerden yönetilmesini sağlar.
 */
export const UI_LABELS = {
	// Sayfa / Bileşen Başlıkları
	ADMIN_TITLE: "Yönetici Paneli",
	AVG_PREP_TIME: "Ortalama Hazırlanma Süresi",
	TOTAL_ORDERS: "Toplam Sipariş",
	VOLUME_CONTROL: "Ses Seviyesi",
	SAVE: "Kaydet",
	SAVED: "Kaydedildi",

	// Sipariş Durumları
	STATUS: {
		[OrderStatus.PREPARING]: "Hazırlanıyor",
		[OrderStatus.READY]: "Hazır",
		[OrderStatus.DELIVERED]: "Teslim Edildi",
		[OrderStatus.CANCELLED]: "İptal Edildi",
	},

	// Müşteri Ekranı (Display) Spesiﬁk Metinler
	DISPLAY: {
		NO_PREPARING_ORDERS: "Hazırlanıyor sipariş yok",
		NO_READY_ORDERS: "Hazır sipariş yok",
	},

	// Sipariş Kolonu Genel Metinler
	ORDERS: {
		EMPTY: "Sipariş yok",
		MINUTES_SHORT: "dk",
		LESS_THAN_A_MINUTE: "<1 dk",
	},
} as const;
