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

	// Admin > Ekran Bazlı URL Override
	SCREEN_URL_BUILDER: {
		TITLE: "Ekran URL'leri",
		DESCRIPTION: "Her ekran için düzen, maksimum sipariş ve yazı ölçeği override URL'i üretir.",
		DEFAULT_SLOT_PREFIX: "Ekran",
		SLOT_NAME_PLACEHOLDER: "Ekran adı",
		REMOVE: "Sil",
		LAYOUT_LABEL: "Düzen",
		MAX_ORDERS_LABEL: "Maks. Sipariş",
		TEXT_SCALE_LABEL: "Yazı Ölçeği",
		GLOBAL_OPTION: "Global",
		COPY: "Kopyala",
		COPIED: "Kopyalandı!",
		COPY_ERROR: "Kopyalanamadı",
		ADD_SCREEN: "+ Ekran Ekle",
	},

	// Admin > Müşteri Ekranı Ayarları
	DISPLAY_SETTINGS: {
		TITLE: "Müşteri Ekranı Ayarları",
		DESCRIPTION: "Profil, düzen ve sayfalama ayarları tüm müşteri ekranlarına uygulanır.",
		URL_OVERRIDE_NOTE:
			"Not: URL parametreleri (`layout`, `max`, `scale`) global ayarların üstüne yazılır.",
		ADVANCED_TITLE: "Gelişmiş: Ekran Bazlı URL Override",
		ADVANCED_DESC:
			"Farklı ekran boyutlarında yalnızca ilgili ekran için layout/max/scale ayarlamak gerektiğinde kullan.",
		PROFILE_LABEL: "Profil",
		LAYOUT_LABEL: "Düzen",
		MAX_PER_COLUMN_LABEL: "Maksimum Sipariş / Kolon",
		PAGE_SECONDS_LABEL: "Sayfa Süresi (sn)",
		RESET_DEFAULTS: "Varsayılanlara Dön",
		OPEN_DISPLAY: "Müşteri Ekranını Aç",
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

	// Ses Ayarları
	AUDIO: {
		ANNOUNCEMENT_VOLUME: "Anons Sesi",
		MUSIC_VOLUME: "Müzik Sesi",
		MUSIC_ENABLED: "Müzik Çal",
		MUSIC_DISABLED: "Müzik Kapalı",
	},

	// Müzik Oynatıcı
	MUSIC_PLAYER: {
		TITLE: "Müzik Oynatıcı",
		NOW_PLAYING: "Şu An Çalıyor",
		PAUSED: "Duraklatıldı",
		STOPPED: "Durduruldu",
		DUCKED: "Anons — kısıldı",
		NO_TRACK: "Parça seçilmedi",
		PLAY: "Oynat",
		PAUSE: "Duraklat",
		SKIP: "İleri",
		PREVIOUS: "Geri",
		LOOP: "Loop",
		SHUFFLE: "Karışık",
	},

	// Müzik Kütüphanesi
	MUSIC_LIBRARY: {
		TITLE: "Müzik Kütüphanesi",
		UPLOAD: "MP3 Yükle",
		UPLOADING: "Yükleniyor...",
		EMPTY: "Henüz parça eklenmedi",
		DELETE: "Sil",
		CONFIRM_DELETE: "Bu parçayı silmek istediğinize emin misiniz?",
		UPLOAD_ERROR: "Yükleme başarısız.",
		DELETE_ERROR: "Silinemedi.",
		DISK_USAGE: "Disk kullanımı",
	},
} as const;
