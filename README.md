# Sepetarasi Order Tracking

LAN tabanlı restoran sipariş takip sistemi — Kasa (Electron), Yönetici Paneli ve Müşteri Ekranı.

---

## Geliştirme (Mac'te)

Pi4'e gerek yok. Hot reload ile hızlı iteration — Mac'te geliştir, Pi4'e sadece sahaya çıkarken deploy et.

```bash
# Terminal 1 — Server
npm run dev:server

# Terminal 2 — Web (Yönetici + Müşteri Ekranı)
npm run dev:web

# Terminal 3 — Kasa (Electron)
cd packages/kasa && npm run dev
```

| Arayüz | Dev (Mac) | Pi4 |
| --- | --- | --- |
| Yönetici Paneli | `localhost:5173` | `sepetarasi.local:3000` |
| Müşteri Ekranı | `localhost:5173/display` | `sepetarasi.local:3000/display` |
| Admin | `localhost:5173/admin` | `sepetarasi.local:3000/admin` |
| API | `localhost:3000` | `sepetarasi.local:3000` |
| Kasa | Electron penceresi (`npm run dev`) | `.app` / `.exe` build |

Kasa sunucu adresini değiştirmek için header'daki bağlantı noktasına tıkla.

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

---

## Sorun Giderme

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
open "$PWD/release/mac-arm64/Sepetarasi Kasa.app"

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
