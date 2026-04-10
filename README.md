# Sepetarasi Order Tracking

LAN tabanlı restoran sipariş takip sistemi — Kasa (Electron), Yönetici Paneli ve Müşteri Ekranı.

---

## Mimari (SSOT)

Bu proje bir **Monorepo** yapısındadır. Tüm paketler `packages/shared` üzerinden ortak tipleri, bileşenleri ve Tailwind temasını paylaşır.

| Paket | Açıklama |
| --- | --- |
| `packages/kasa` | Electron tabanlı kasiyer arayüzü (Windows/macOS) |
| `packages/web` | Yönetici paneli ve Müşteri takip ekranı (Vite/React) |
| `packages/server` | Fastify tabanlı API ve WebSocket sunucusu |
| `packages/shared` | **Single Source of Truth:** Ortak mantık, tipler ve ikonlar |

---

## İlk Kurulum

```bash
npm install
npm run build        # shared → web → kasa → server sırasıyla derler
npm run db:migrate
npm run db:seed
```

---

## Geliştirme (Mac'te)

Pi4'e gerek yok. Ses macOS'ta `afplay` ile çalışır.

```bash
# Terminal 1 — Server
npm run dev:server

# Terminal 2 — Web (Yönetici + Müşteri Ekranı)
npm run dev:web

# Terminal 3 — Kasa (Electron)
cd packages/kasa && npm run dev
```

| Arayüz | URL |
| --- | --- |
| Yönetici Paneli | `http://localhost:5173` |
| Müşteri Ekranı | `http://localhost:5173/display` |
| Admin | `http://localhost:5173/admin` |
| API | `http://localhost:3000` |

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
```

`deploy.sh` sırasıyla: Mac'te build → rsync ile Pi4'e gönder → migration → servis restart → `/health` kontrolü.

`--init` Pi4 hostname'ini `sepetarasi` yapar → `sepetarasi.local:3000` ile erişim, IP değişse de çalışır.

**Pi4'te neler açılır:**

| Arayüz | URL |
| --- | --- |
| Yönetici Paneli | `http://sepetarasi.local:3000` |
| Müşteri Ekranı | `http://sepetarasi.local:3000/display` |
| Admin | `http://sepetarasi.local:3000/admin` |

> **Windows 10/11:** `.local` hostname için Bonjour gerekebilir — iTunes ile gelir veya [Apple'dan](https://support.apple.com/downloads/bonjour-for-windows) ayrıca kurulur.

**`--init` ne zaman tekrar gerekir?**

- Yeni Pi4 / yeni SD kart / OS reimage
- `sepetarasi.service` silindiyse veya `mpg123` eksikse
- Hostname veya audio route ayarları bozulduysa

---

## Kasa (Electron) — Build

```bash
# macOS .app
cd packages/kasa && npm run build
open "$PWD/release/mac-arm64/Sepetarasi Kasa.app"

# Windows .exe (Mac üzerinde cross-compile)
cd packages/kasa && npm run build:win
```

> İkon değiştirmek için `packages/kasa/build/icon.png` güncelle → `./scripts/generate-icons.sh` çalıştır.

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

---

## Commit Öncesi Kalite Kontrolü

Startup sırasında terminal zaten hataları gösterir — CI'a gerek yok. CI **sadece commit/push öncesi**:

```bash
npm run ci              # lint + typecheck + test
npm run lint:fix        # Biome otomatik düzeltme
npm run test:coverage   # coverage ≥ %80 kontrolü
```

Müşteriye gitmeden önce Pi4 üzerinde smoke test:

```bash
bash scripts/pi4-smoke-test.sh   # API + WS + ses
```

---

## Sorun Giderme

**Port çakışması** — Server başlamıyor, Vite 5174/5175'e kaydı:

```bash
kill -9 $(lsof -t -i :3000) 2>/dev/null; true
```

Neden olur: Terminal kapatılırken Node.js tam sonlanmamış → port 3000 zombie'de kalmış → Vite boşta port aradı. Zombie öldürülünce 5173 de serbest kalır.

**shared build eksik** — `BasketIcon` veya ortak bileşenler bulunamıyor:

```bash
npm run build -w packages/shared
```

Neden olur: `npm install` sonrası ilk `npm run build` atlandıysa.

---

## API & WebSocket

| Method | Endpoint | Açıklama |
| --- | --- | --- |
| POST | `/api/v1/orders` | Sipariş oluştur |
| GET | `/api/v1/orders` | Günün siparişleri |
| PATCH | `/api/v1/orders/:id/status` | Durum değiştir |
| GET | `/api/v1/stats/today` | İstatistikler |
| GET | `/api/v1/settings` | Tüm ayarlar |
| PATCH | `/api/v1/settings/:key` | Ayar güncelle |
| WS | `/ws?channel=orders` | Canlı güncellemeler |
| WS | `/ws?channel=display` | Anons olayları |

---

## Ortam Değişkenleri (.env)

```env
PORT=3000
DB_PATH=./data/sepetarasi.db
STORE_TIMEZONE=Europe/Istanbul
JWT_SECRET=replace-with-strong-secret          # production'da zorunlu
COOKIE_SECRET=replace-with-strong-secret       # production'da zorunlu
CASHIER_TOKEN=replace-with-strong-token        # production'da zorunlu
ANNOUNCEMENTS_PATH=./packages/server/assets/announcements
AUDIO_ALSA_DEVICE=hw:2,0                       # Pi4 3.5mm jack; alternatif: plughw:CARD=Headphones,DEV=0 — index için: aplay -l
DISABLE_AUDIO=false
ENABLE_TTS_FALLBACK=false
WS_AUTH_KEY=replace-with-strong-key            # WebSocket için zorunlu; VITE_WS_AUTH_KEY ile eşleşmeli
VITE_WS_AUTH_KEY=replace-with-strong-key
```

---

## Sesli Anons (Pi4)

Pre-recorded MP3 zorunlu (`1.mp3` … `400.mp3`), TTS fallback varsayılan kapalı.

```bash
npm run audio:generate   # 400 MP3 üret (macOS, say + ffmpeg gerekli)
```

Ses cihazı: `AUDIO_ALSA_DEVICE=hw:2,0` → 3.5mm jack. Cihaz indexi için: `aplay -l`

Ses çıkışını 3.5mm jack'e zorlamak: `sudo raspi-config nonint do_audio 1`
