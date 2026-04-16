# SEPET ARASI Order Tracking

LAN tabanlı restoran sipariş takip sistemi — Kasa (Electron), Yönetici Paneli ve Müşteri Ekranı.

---

## Geliştirme (Mac'te)

İki mod var — hangisini kullanacağın o anki işe göre seçilir:

**Mod 1 — Tamamen lokal (UI geliştirme, birim testler):**
Pi4 gerekmez. Mac'te local server + local DB ile çalışır.

```bash
# Terminal 1 — Server
npm run dev:server

# Terminal 2 — Web (Yönetici + Müşteri Ekranı)
npm run dev:web

# Terminal 3 — Kasa (Electron)
cd packages/kasa && npm run dev
```

**Mod 2 — Pi4 verisiyle geliştirme (gerçek sipariş akışı, entegrasyon):**
Pi4 çalışıyor olmalı. Hot reload Mac'te, data Pi4'ten gelir. Lokal server açma.

```bash
# Terminal 1 — Web UI (admin panel, display)
npm run dev:web:pi4

# Terminal 2 — Kasa Electron
cd packages/kasa && npm run dev
```

> Kasa ilk açılışta config ekranında server URL'yi `http://sepetarasi.local:3000` yap ve kaydet — bir daha sormaz.
> **İstisna:** `packages/server` kodunu değiştirdiysen hot reload olmaz — değişiklik Pi4'e ancak `bash scripts/deploy.sh` ile gider. O durumda Mod 1'e geç.

| Arayüz | Lokal Dev | Pi4 Dev (`dev:web:pi4`) | Pi4 Production |
| --- | --- | --- | --- |
| Yönetici Paneli | http://localhost:5173 | http://localhost:5173 | http://sepetarasi.local:3000 |
| Müşteri Ekranı | http://localhost:5173/display | http://localhost:5173/display | http://sepetarasi.local:3000/display |
| Admin | http://localhost:5173/admin | http://localhost:5173/admin | http://sepetarasi.local:3000/admin |
| API | http://localhost:3000 | http://sepetarasi.local:3000 | http://sepetarasi.local:3000 |
| Kasa | Electron penceresi | — | `.app` / `.exe` build |

Kasa sunucu adresini değiştirmek için header'daki bağlantı noktasına tıkla.

### Kasa Bağlantı Bilgileri

| Ortam | Sunucu Adresi | Kasiyer Token |
| --- | --- | --- |
| Mac (lokal dev) | `http://localhost:3000` | `local-dev-cashier-token` |
| Pi4 (production) | `http://sepetarasi.local:3000` | `grep CASHIER_TOKEN /opt/sepetarasi/.env` |

Kasa Electron uygulaması bu bilgileri `config.json`'a kaydeder — deploy sonrası tekrar girilmesine gerek yok.

### Commit Öncesi

```bash
npm run ci              # lint + typecheck + test
npm run lint:fix        # Biome otomatik düzeltme
npm run test:coverage   # coverage raporu — dosya bazında % gösterir
```

Müşteriye gitmeden önce Pi4 üzerinde smoke test:

```bash
bash scripts/pi4-smoke-test.sh   # API + WS + ses
```

---

## Deploy & Release Sırası

```bash
# 1. CI geç
npm run ci

# 2. Pi4'e deploy et (server güncellenir)
bash scripts/deploy.sh

# 3. macOS kasa build (çıktı: packages/kasa/release/mac-arm64/*.app)
cd packages/kasa && npm run build:mac

# 4. Windows kasa build — Mac'ten cross-compile (çıktı: packages/kasa/release/*.exe)
cd packages/kasa && npm run build:win
```

> Kasa build'leri Pi4 deploy'undan sonra yapılır — server güncellenmeden kasa dağıtılırsa API uyumsuzluğu olabilir.
> Windows cross-compile için Mac'te `wine` gerekebilir: `brew install --cask wine-stable`

---

## Pi4'e Deploy

```bash
# Bir kez: SSH key kur + .pi4 dosyası oluştur
ssh-keygen -t ed25519
ssh-copy-id admin@<PI4-IP>
echo 'admin@<PI4-IP>' > .pi4   # gitignored, sonraki deploylar için

# Yeni Pi4 — ilk kurulum
bash scripts/deploy.sh --init

# Kod güncellemesi gönder
bash scripts/deploy.sh

# Token'ı unut/gerekirsen: ssh ile bak
ssh admin@sepetarasi.local "grep CASHIER /opt/sepetarasi/.env"
```

`deploy.sh` sırasıyla: Mac'te build → rsync ile Pi4'e gönder → migration → servis restart → `/health` kontrolü.
`deploy.sh --init` bunlara ek olarak audit log path'ini hazırlar ve Pi4 observability kurulumunu otomatik tetikler.
Deploy, Pi4 uzerindeki runtime muzik kutuphanesini (`packages/server/assets/music`) korur; yuklenen MP3'ler yeni release yayinlarken silinmez.

`--init` Pi4 hostname'ini `sepetarasi` yapar → `sepetarasi.local:3000` ile erişim, IP değişse de çalışır.

> **Windows 10/11:** `.local` hostname için Bonjour gerekebilir — iTunes ile gelir veya [Apple'dan](https://support.apple.com/downloads/bonjour-for-windows) ayrıca kurulur.

**`--init` ne zaman tekrar gerekir?**

- Yeni Pi4 / yeni SD kart / OS reimage
- `sepetarasi.service` silindiyse veya `mpg123` eksikse
- Hostname veya audio route ayarları bozulduysa

---

## Pi4 Servis Yönetimi

```bash
# Pi4 üzerinde
sudo systemctl status sepetarasi
sudo systemctl restart sepetarasi
journalctl -u sepetarasi -f

# Mac'ten uzaktan
ssh admin@sepetarasi.local "sudo journalctl -u sepetarasi -f"
```

## Pi4 Gozlemlenebilirlik (CPU/RAM/Isi)

`bash scripts/deploy.sh --init` bunu otomatik kurar. Eski kurulmus Pi4'lerde veya yeniden kurmak istiyorsan manuel de calistirabilirsin:

```bash
bash scripts/pi4-enable-observability.sh
# veya hedefi elle ver
bash scripts/pi4-enable-observability.sh admin@sepetarasi.local
```

Kurulumun yaptigi seyler:

- `journald` kalici moda alinir (`Storage=persistent`)
- Her 1 dakikada bir JSON satir metrik logu yazilir:
  `/var/log/sepetarasi/system-metrics.log`
- Audit log dosyasi proje klasoru disina alinip korunur:
  `/var/log/sepetarasi/audit.log`
- Boot baslangic/bitis marker'i eklenir (`boot_start`, `boot_stop`)
- Log boyutu icin logrotate kurulur

Gece analizi ornekleri:

```bash
# Boot listesi
ssh admin@sepetarasi.local "journalctl --list-boots --no-pager"

# Kernel tarafinda isi/throttle/oom taramasi
ssh admin@sepetarasi.local \
  "journalctl -k --since '2026-04-15 20:00' --until '2026-04-16 08:00' --no-pager \
   | egrep -i 'thermal|thrott|under-voltage|oom|out of memory|killed process'"

# Uygulama + sistem metrik JSON logu (cpu_temp_c, throttled_raw, mem_available_kb, server_rss_kb)
ssh admin@sepetarasi.local \
  "awk '\$0 ~ /\"ts\":\"2026-04-15|\"ts\":\"2026-04-16/ {print}' /var/log/sepetarasi/system-metrics.log"

# Audit logu (login/order/status vb.)
ssh admin@sepetarasi.local "tail -n 20 /var/log/sepetarasi/audit.log"
```

---

## Sorun Giderme

**Siparişler karışıyor / lokal ve Pi4 verisi çakışıyor:**
Lokal `dev:server` açıkken aynı anda Pi4'e de bağlanırsan iki ayrı DB olur — siparişler birbirinde görünmez, numara sayacı çakışır.
Kural: **Ya lokal server çalışır ya Pi4.** Pi4 verisiyle geliştirmek için `dev:web:pi4` kullan, lokal server açma.

**Port çakışması** — Server başlamıyor, Vite 5174/5175'e kaydı:

```bash
kill -9 $(lsof -t -i :3000) 2>/dev/null; true
```

Neden olur: Terminal kapatılırken Node.js tam sonlanmamış → port 3000 zombie'de kalmış. Ctrl+C ile durdurursan olmaz.

**shared build eksik** — Ortak tipler bulunamıyor:

```bash
npm run build -w packages/shared
```

Neden olur: `npm install` sonrası ilk `npm run build` atlandıysa veya `packages/shared` değiştirilip build edilmediyse.

---

## Kasa (Electron) — Build

```bash
# macOS .app
cd packages/kasa && npm run build
open "$PWD/release/mac-arm64/SEPET ARASI KASA.app"

# Windows .exe (Mac üzerinde cross-compile)
cd packages/kasa && npm run build:win
```

> İkon değiştirmek için `packages/kasa/build/icon.png` güncelle (1024x1024 PNG) → `bash scripts/generate-icons.sh packages/kasa/build/icon.png packages/kasa/build` çalıştır.

---

## İlk Kurulum

```bash
npm install
npm run build        # shared → web → kasa → server sırasıyla derler
npm run db:migrate
npm run db:seed
cp packages/server/.env.example packages/server/.env
cp packages/kasa/.env.example packages/kasa/.env
```

---

## Özellik Eklerken Dikkat

- **`packages/shared` değişince** → `npm run build -w packages/shared` çalıştır, diğer paketler build'i görür
- **Yeni DB alanı eklenince** → migration oluştur ve `npm run db:migrate` çalıştır; atlanırsa prod crash eder
- **Kasa renderer'ında Node API yok** → Electron'a sadece `window.electronAPI` (preload) üzerinden eriş
- **Ses kodu iki yol** → Pi4'te `mpg123`/ALSA, Mac'te `afplay`; her ikisini de test et
- **Stats sorguları timezone'a bağlı** → `STORE_TIMEZONE` olmadan testler yanlış sonuç verir
- **WebSocket auth** → `WS_AUTH_KEY` ↔ `VITE_WS_AUTH_KEY` eşleşmezse WS bağlanır ama "Unauthorized" alır

---

## API & WebSocket

| Method | Endpoint | Açıklama |
| --- | --- | --- |
| POST | `/api/v1/orders` | Sipariş oluştur |
| GET | `/api/v1/orders` | Günün siparişleri (opsiyonel: `?business_date=&status=`) |
| GET | `/api/v1/orders/:id` | Tekil sipariş |
| PATCH | `/api/v1/orders/:id/status` | Durum değiştir |
| DELETE | `/api/v1/orders/:id` | Sipariş sil (admin) |
| GET | `/api/v1/stats/today` | Bugünün istatistikleri |
| GET | `/api/v1/stats` | Dönem istatistikleri (`?period=daily\|weekly\|monthly`) |
| GET | `/api/v1/settings` | Tüm ayarlar (admin) |
| PATCH | `/api/v1/settings/:key` | Ayar güncelle |
| POST | `/api/v1/auth/logout` | Çıkış |
| GET | `/api/v1/auth/me` | Oturum bilgisi |
| GET | `/health` | Sunucu sağlık kontrolü |
| WS | `/ws?channel=orders` | Canlı sipariş güncellemeleri |
| WS | `/ws?channel=display` | Anons olayları |

---

## Ortam Değişkenleri (.env)

`packages/server/.env` ve `packages/kasa/.env` — örnek dosyalar `.env.example` olarak repo'da mevcut.

`WS_AUTH_KEY` (server) ile `VITE_WS_AUTH_KEY` (kasa) her zaman aynı değer olmalı.

---

## Mimari (SSOT)

Bu proje bir **Monorepo** yapısındadır. Tüm paketler `packages/shared` üzerinden ortak tipleri, bileşenleri ve Tailwind temasını paylaşır.

| Paket | Açıklama |
| --- | --- |
| `packages/kasa` | Electron tabanlı kasiyer arayüzü (Windows/macOS) |
| `packages/web` | Yönetici paneli ve Müşteri takip ekranı (Vite/React) |
| `packages/server` | Fastify tabanlı API ve WebSocket sunucusu |
| `packages/shared` | **Single Source of Truth:** Ortak mantık ve tipler (React bağımlılığı yok) |

---

## Sesli Anons (Pi4)

Pre-recorded MP3 zorunlu (`1.mp3` … `400.mp3`), TTS fallback varsayılan kapalı.

```bash
npm run audio:generate   # 400 MP3 üret (macOS, say + ffmpeg gerekli)
```

Ses cihazı: `AUDIO_ALSA_DEVICE=hw:2,0` → 3.5mm jack. Cihaz indexi için: `aplay -l`

Ses çıkışını 3.5mm jack'e zorlamak: `sudo raspi-config nonint do_audio 1`

---

## Teslim Öncesi Kontrol Listesi (`--init` sonrası)

`bash scripts/deploy.sh --init`, Pi4 üzerindeki `.env` dosyasını yeniden oluşturur. Bu işlem yeni `CASHIER_TOKEN`, `JWT_SECRET` ve `COOKIE_SECRET` üretir. Bunlardan kasa tarafını doğrudan etkileyen kritik değer `CASHIER_TOKEN`'dır; eski token geçersiz olur. Kasa uygulaması kendi ayarlarını `config.json` içinde tuttuğu için aynı kasa cihazı ve aynı URL kullanılacaksa çoğu durumda sadece token güncellemek yeterlidir.

Teslim öncesi eksiksiz kontrol:

1. Pi4 üzerindeki yeni kasiyer token'ını al:

```bash
ssh admin@sepetarasi.local "grep CASHIER_TOKEN /opt/sepetarasi/.env"
```

2. Kasa config ekranında `serverUrl` değerini doğrula:

```text
http://sepetarasi.local:3000
```

3. Kasa config ekranına yeni `cashierToken` değerini gir ve kaydet.
4. Yazıcı kullanılacaksa `printerIp` girildiğini doğrula. Boş bırakılırsa fiş yazdırma devre dışı kalır.
5. Yeni veya temiz DB ile kurulum yapıldıysa admin şifresini kontrol et. İlk varsayılan şifre `admin123` olur; müşteriye teslim etmeden değiştirmen önerilir.
6. Son doğrulama olarak Pi4 smoke test çalıştır:

```bash
bash scripts/pi4-smoke-test.sh
```

Kısa özet:

- Aynı kasa cihazı ve aynı URL kullanılıyorsa çoğu durumda sadece yeni token girmek yeterlidir.
- Müşteriye teslim standardı: `cashierToken` kontrolü, admin şifre kontrolü, gerekiyorsa `printerIp`, ardından smoke test.
