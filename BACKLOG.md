# Backlog

MVP sonrası ertelenen iyileştirmeler. Öncelik sırası yaklaşık.

---

## Deploy / Pi4

### [ ] pi4-deploy.sh: build sonrası dev deps prune et

**Neden:** `npm ci` ile kurulan dev deps (typescript, vite, tsx, test araçları ~300-500MB)
build sonrası Pi4'te gereksiz kalıyor. Runtime'ı etkilemez ama SD kart dolma riskini artırır.

**Nasıl yapılır:**
1. Build + migration copy adımından sonra `npm prune --omit=dev` ekle
2. `npm run db:migrate` ve `npm run db:seed` adımlarını kaldır
   (tsx prune sonrası çalışmaz; server startup zaten migrate ediyor, seed idempotent)
3. Test: `bash scripts/pi4-smoke-test.sh`

**Öncelik:** Düşük-Orta — 7/24 çalışan production Pi4'te 6-12 ay sonra disk alanı için önem kazanır.

---

## Ses / Anons

### [ ] 400+ sipariş numarası için sessiz fallback sorunu

**Neden:** Günde 400'den fazla sipariş olursa MP3 dosyası yok, TTS kapalı → anons sessiz geçiyor. Operatör ve müşteri fark etmiyor.

**Nasıl yapılır:**

- Seçenek A: `scripts/generate-audio.sh` ile 401-500 arası da üret (5 dakika iş)
- Seçenek B: `audio-playback.service.ts`'te sadece `displayNo > 400` için TTS fallback aktif et

**Öncelik:** Düşük — günde 400'ü geçen yoğunluk için sistem zaten büyütülmeli.

---

## API / Stats

### [ ] Stats API: `?period=` enum → `?from=&to=` date range

**Neden:** Şu an `daily|weekly|monthly` sabit enum. Yönetici belirli tarih aralığı görmek isterse mümkün değil.

**Nasıl yapılır:**

- `StatsService.getByPeriod()` → `getByDateRange(from, to)` olarak genişlet
- `GET /api/v1/stats?from=2026-03-01&to=2026-04-05` formatına geç
- Etkilenen: `stats.service.ts`, `routes/stats.ts`, `web/lib/api.ts`, `AdminView.tsx`

**Öncelik:** Düşük — mevcut period enum MVP için yeterli.

---

## Admin / Ayarlar

### [ ] Admin Ayarlar Paneli

**Neden:** Müşteri ekranının görünümü (tema, yazı boyutu, arka plan rengi) ve hedef hazırlanma süresi şu an sabit. Yöneticinin bunları arayüzden değiştirebilmesi gerekiyor.

**Nasıl yapılır:**

- `PATCH /api/v1/settings` endpoint ekle (`routes/settings.ts`)
- `target_minutes` alanı zaten `orders` tablosunda var, kullanıma aç
- `CustomerDisplay.tsx`'e hazırlanma süresi bazlı renk uyarısı ekle (son 2 dk kırmızı)
- `AdminView.tsx`'e "Ayarlar" sekmesi: tema, font boyutu, default hedef süre
- `app_settings` tablosu zaten var, migration gerekmez

**Öncelik:** Orta — yeni pencerede ayrı oturum açarak yapılacak.

**Not:** Bu panel yapılırken README'ye `/admin` route ve ayarlar bölümü de eklenmeli.

---

## Admin / Metrik Görseli

### [ ] Ortalama süre için görsel grafik

**Neden:** AdminView'da şu an sadece büyük sayı gösteriliyor. Günlük trend veya hedefe göre doluluk çubuğu görsel olarak daha anlamlı olabilir.

**Seçenekler:**

- Seçenek A (sıfır dependency): CSS progress bar
  ```
  Ortalama: [████████░░] 14.3 dk / 20 dk hedef
  ```
- Seçenek B: `recharts` kütüphanesi ile çizgi grafik (günlük trend)

**Öncelik:** Düşük — Admin Ayarlar Paneli yapıldıktan sonra ele alınmalı (target_minutes oraya bağlı).

---

## Müşteri Ekranı / Display

### [ ] useVisibleReadyOrders: Date.now() stale time sorunu

**Neden:** `useVisibleReadyOrders` hook'u `Date.now()`'ı render anında alıyor; `useMemo`
dependency listesinde zaman yok. Hazır siparişler `readyDisplayMinutes` sınırını geçse bile
state güncellenmeden liste ekrandan düşmüyor. (Şu an her 60 sn'de `tick` state'i tetiklendiği
için maksimum 60 sn gecikmeyle düzeliyor — kritik değil ama kesin çözüm değil.)

**Nasıl yapılır:**

- Seçenek A: Mevcut `tick` interval'ını `useVisibleReadyOrders`'a prop olarak geçir ve
  dependency'ye ekle — sıfır dependency değişikliği.
- Seçenek B: Hook'u `now` parametresi alacak şekilde pure yap, `CustomerDisplay`'den `Date.now()`
  geçir (tick tetiklendiğinde yeniden hesaplanır).

**Öncelik:** Düşük — mevcut 60 sn tick yeterli görünüyor, aktif bildirim yapılan siparişler
zaten `nowPlaying` üzerinden vurgulanıyor.

---

### [ ] OrdersColumn: 15 prop yerine tema objesi geçir

**Neden:** `OrdersColumn` şu an 15 prop taşıyor; çoğu CSS class string olup tema nesnelerinden
geliyor. Yeni prop eklendikçe arayüz büyüyor.

**Nasıl yapılır:**

- `ColumnTheme` interface'i ekle: `{ railClass, titleClass, kpiCardClass, kpiNumberClass,
  badgeClass, highlightClass, emptyTextClass }` alanları.
- `CustomerDisplay` theme nesnesinden `ColumnTheme` objeleri derive et ve tek prop olarak geç.
- Kalan scalar prop'lar (`title`, `count`, `orders`, `titleSizeClass`, `kpiCardSizeClass`,
  `orderTextClass`, `emptyText`, `highlightOrderId`, `containerClass`) ayrı kalır.

**Öncelik:** Düşük — mevcut arayüz fonksiyonel, tema değişmediği sürece prop sayısı artmıyor.

---

## QA / Windows

### [ ] Windows validation otomasyonu (Playwright/Windows runner)

**Neden:** Windows kalite kapısı şu an manuel checklist'e bağlı. Otomasyon, regression'ları release öncesinde daha erken yakalar.

**Nasıl yapılır:**
1. `windows-latest` runner'da `npm run build:win` adımını CI'ya ekle
2. Kasa uygulaması için temel smoke senaryolarını otomatikleştir (açılış, bağlantı, sipariş akışı, reconnect, config kalıcılık)
3. Manuel checklist'i otomasyon kapsamı dışında kalan adımlar için koru

**Öncelik:** Orta — MVP'de manuel gate yeterli, release sayısı arttıkça otomasyon kritik hale gelir.
