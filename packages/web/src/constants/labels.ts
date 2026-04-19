import { OrderStatus } from "@sepetarasi/shared";

/**
 * UI Etiketleri (İnsan Okunur Metinler) - Single Source of Truth
 * Uygulamanın metinlerinin tek bir yerden yönetilmesini sağlar.
 */
export const UI_LABELS = {
	// Sayfa / Bileşen Başlıkları
	ADMIN_TITLE: "Yönetim Paneli",
	AVG_PREP_TIME: "Ortalama Hazırlanma Süresi",
	AVG_DELIVERY_TIME: "Ortalama Teslim Süresi",
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
		SETTINGS_SYNC_WARNING: "Ekran ayarları alınamadı. Son bilinen görünüm kullanılıyor.",
		SETTINGS_SYNC_RETRY: "Tekrar Dene",
	},

	// Admin > Müşteri Ekranı Ayarları
	DISPLAY_SETTINGS: {
		TITLE: "Müşteri Ekranı Ayarları",
		PROFILE_LABEL: "Profil",
		LAYOUT_LABEL: "Düzen",
		MAX_PER_COLUMN_LABEL: "Maksimum Sipariş / Kolon",
		PAGE_SECONDS_LABEL: "Sayfa Süresi (sn)",
		RESET_DEFAULTS: "Varsayılanlara Dön",
		OPEN_DISPLAY: "Müşteri Ekranını Aç",
		OPEN_TB1_DISPLAY: "Alternatif Ekranı Aç",
		AUTO_OPTION: "Otomatik",
		LAYOUT_SPLIT: "Yan Yana",
		LAYOUT_STACK: "Altlı Üstlü",
		LOAD_ERROR: "Ayarlar yüklenemedi. Lütfen bağlantıyı kontrol edin.",
		LOAD_AUTH_ERROR: "Oturum doğrulanamadı. Sayfayı yenileyip tekrar giriş yapın.",
		LOAD_NETWORK_ERROR: "Ayarlar yüklenemedi. Sunucuya ulaşılamıyor.",
		SAVE_ERROR: "Ayarlar kaydedilemedi. Lütfen tekrar deneyin.",
		RETRY_BUTTON: "Yeniden Dene",
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
		SECONDS_SHORT: "sn",
		HOURS_SHORT: "sa",
		LESS_THAN_A_MINUTE: "<1 dk",
	},

	// Ses Ayarları
	AUDIO: {
		ANNOUNCEMENT_VOLUME: "Anons Sesi",
		ANNOUNCEMENT_HELP: "Mağaza içi anons seviyesini yönetin.",
		ANNOUNCEMENT_ENABLED: "Anons Çal",
		ANNOUNCEMENT_DISABLED: "Anons Kapalı",
		MUSIC_VOLUME: "Müzik Sesi",
		MUSIC_HELP: "Arka plan müziğinin seviyesini yönetin.",
		MUSIC_ENABLED: "Müzik Çal",
		MUSIC_DISABLED: "Müzik Kapalı",
		LOAD_ERROR: "Ses ayarları yüklenemedi. Lütfen tekrar deneyin.",
		LOAD_AUTH_ERROR: "Oturum doğrulanamadı. Sayfayı yenileyip tekrar giriş yapın.",
		LOAD_NETWORK_ERROR: "Ses ayarları yüklenemedi. Sunucuya ulaşılamıyor.",
		RETRY_BUTTON: "Yeniden Dene",
	},

	// Hızlı Not Presetleri
	NOTE_PRESETS: {
		TITLE: "Hazır Notlar",
		LOAD_ERROR: "Hazır notlar yüklenemedi. Lütfen bağlantıyı kontrol edin.",
		LOAD_AUTH_ERROR: "Oturum doğrulanamadı. Sayfayı yenileyip tekrar giriş yapın.",
		LOAD_NETWORK_ERROR: "Hazır notlar yüklenemedi. Sunucuya ulaşılamıyor.",
		SAVE_ERROR: "Hazır notlar kaydedilemedi. Lütfen tekrar deneyin.",
		EMPTY_STATE: "Henüz hazır not yok",
		EMPTY_STATE_HINT: "İlk notu aşağıdan ekleyin.",
		INPUT_LABEL: "Yeni not",
		ADD_BUTTON: "Notu Ekle",
		REMOVE_BUTTON: "Sil",
		RETRY_BUTTON: "Yeniden Dene",
		PLACEHOLDER: "Ör. Ketçap bol",
		MAX_LENGTH_ERROR: "Not en fazla 50 karakter olabilir",
		EMPTY_ERROR: "Not boş olamaz",
		DUPLICATE_ERROR: "Bu not zaten listede",
		MAX_ITEMS_ERROR: "En fazla 20 hazır not ekleyebilirsiniz",
		SAVING: "Notlar kaydediliyor...",
		ADD_SUCCESS: "Not eklendi",
		REMOVE_SUCCESS: "Not kaldırıldı",
	},

	// Müzik Oynatıcı
	MUSIC_PLAYER: {
		TITLE: "Müzik Oynatıcı",
		NOW_PLAYING: "Şu An Çalıyor",
		PAUSED: "Duraklatıldı",
		STOPPED: "Durduruldu",
		DUCKED: "Anons — kısıldı",
		LOOP_BADGE: "Döngü açık",
		SHUFFLE_BADGE: "Karışık çal",
		NO_TRACK: "Parça seçilmedi",
		PLAY: "Oynat",
		PAUSE: "Duraklat",
		SKIP: "Sonraki parça",
		PREVIOUS: "Önceki parça",
		LOOP_ON: "Döngü açık — Tümünü tekrar et",
		LOOP_OFF: "Döngüyü aç",
		SHUFFLE_ON: "Karışık Çal açık",
		SHUFFLE_OFF: "Karıştır",
		LOAD_ERROR: "Oynatıcı durumu yüklenemedi. Lütfen tekrar deneyin.",
		LOAD_AUTH_ERROR: "Oturum doğrulanamadı. Sayfayı yenileyip tekrar giriş yapın.",
		LOAD_NETWORK_ERROR: "Oynatıcı durumu yüklenemedi. Sunucuya ulaşılamıyor.",
		RETRY_BUTTON: "Yeniden Dene",
	},

	// Müzik Kütüphanesi
	MUSIC_LIBRARY: {
		TITLE: "Müzik Kütüphanesi",
		UPLOAD: "MP3 Yükle",
		UPLOADING: "Yükleniyor...",
		UPLOAD_LEAVE_WARNING:
			"Yükleme sürerken sayfayı yenilemeyin, sekmeyi kapatmayın veya uygulamadan çıkmayın.",
		TRACK_COUNT: "Toplam parça",
		LIBRARY_SIZE: "Arşiv boyutu",
		FREE_SPACE: "Boş alan",
		EMPTY: "Henüz parça eklenmedi",
		LOAD_ERROR: "Müzik kütüphanesi yüklenemedi. Lütfen tekrar deneyin.",
		LOAD_AUTH_ERROR: "Oturum doğrulanamadı. Sayfayı yenileyip tekrar giriş yapın.",
		LOAD_NETWORK_ERROR: "Müzik kütüphanesi yüklenemedi. Sunucuya ulaşılamıyor.",
		RETRY_BUTTON: "Yeniden Dene",
		DELETE: "Sil",
		CONFIRM_DELETE: "Bu parçayı silmek istediğinize emin misiniz?",
		UPLOAD_ERROR: "Yükleme başarısız.",
		DELETE_ERROR: "Silinemedi.",
		DISK_USAGE: "Disk kullanımı",
		SELECT_MODE: "Toplu Seç",
		SELECT_CANCEL: "Kapat",
		SELECT_ALL: "Tümünü Seç",
		DESELECT_ALL: "Seçimi Kaldır",
		DELETE_SELECTED: "Seçilenleri Sil",
	},
} as const;
