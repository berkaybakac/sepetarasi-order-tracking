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
		NOW_SERVING: "Şimdi Servis",
		PREPARING_TITLE: "Hazırlanıyor",
		READY_TITLE: "Hazır",
		PAGE: "Sayfa",
		NO_PREPARING_ORDERS: "Hazırlanan sipariş yok",
		NO_READY_ORDERS: "Hazır sipariş yok",
	},

	// Admin > Müşteri Ekranı Ayarları
	DISPLAY_SETTINGS: {
		TITLE: "Müşteri Ekranı Ayarları",
		DESCRIPTION: "Profil, düzen ve sayfalama ayarları tüm müşteri ekranlarına uygulanır.",
		PROFILE_LABEL: "Profil",
		LAYOUT_LABEL: "Düzen",
		MAX_PER_COLUMN_LABEL: "Maksimum Sipariş / Kolon",
		PAGE_SECONDS_LABEL: "Sayfa Süresi (sn)",
		RESET_DEFAULTS: "Varsayılanlara Dön",
		AUTO_OPTION: "Otomatik",
		LAYOUT_SPLIT: "Yan Yana",
		LAYOUT_STACK: "Altlı Üstlü",
		LOAD_ERROR: "Ayarlar yüklenemedi. Lütfen bağlantıyı kontrol edin.",
		SAVE_ERROR: "Ayarlar kaydedilemedi. Lütfen tekrar deneyin.",
		DECREASE: "Azalt",
		INCREASE: "Artır",
		RESTAURANT_NAME_LABEL: "Restoran Adı",
		RESTAURANT_NAME_PLACEHOLDER: "Örn. Sepetarası Mutfak",
		READY_DISPLAY_MINUTES_LABEL: "Hazır Gösterim Süresi (dk)",
		TEXT_SCALE_LABEL: "Yazı Ölçeği",
		TEXT_SCALE_S: "Küçük (S)",
		TEXT_SCALE_M: "Orta (M)",
		TEXT_SCALE_L: "Büyük (L)",
		THEME_LABEL: "Tema",
		THEME_DARK: "Karanlık",
		THEME_LIGHT: "Açık",
		THEME_VIVID: "Canlı",
		THEME_RETRO: "Retro",
	},

	// Sipariş Kolonu Genel Metinler
	ORDERS: {
		EMPTY: "Sipariş yok",
		MINUTES_SHORT: "dk",
		LESS_THAN_A_MINUTE: "<1 dk",
	},
} as const;
