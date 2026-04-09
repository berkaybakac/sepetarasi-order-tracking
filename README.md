# Sepetarasi Order Tracking

LAN tabanlı restoran sipariş takip sistemi — Kasa (Electron), Yönetici Paneli ve Müşteri Ekranı.

---

## Mimari (SSOT)

Bu proje bir **Monorepo** yapısındadır. Tüm paketler `packages/shared` üzerinden ortak tipleri, bileşenleri (`BasketIcon` vb.) ve Tailwind temasını paylaşır.

| Paket | Açıklama |
| --- | --- |
| `packages/kasa` | Electron tabanlı kasiyer arayüzü (Windows/macOS) |
| `packages/web` | Yönetici paneli ve Müşteri takip ekranı (Vite/React) |
| `packages/server` | Fastify tabanlı API ve WebSocket sunucusu |
| `packages/shared` | **Single Source of Truth:** Ortak mantık, tipler ve ikonlar |

---

## Erişim (Pi4)

`--init` ile kurulumdan sonra aynı ağdaki tüm cihazlar hostname ile bağlanır:

| Arayüz | URL |
| --- | --- |
| Yönetici Paneli | `http://sepetarasi.local:3000` |
| Müşteri Ekranı | `http://sepetarasi.local:3000/display` |
| Admin | `http://sepetarasi.local:3000/admin` |

macOS'tan açmak için:

```bash
open http://sepetarasi.local:3000
open http://sepetarasi.local:3000/display
open http://sepetarasi.local:3000/admin
```

SSH erişimi:

```bash
ssh admin@sepetarasi.local
```

---

## İlk Kurulum & Build

Geliştirme makinesinde tüm projeyi hazır hale getirmek için:

```bash
npm install
npm run build        # Tüm paketleri (shared -> web -> kasa -> server) derler
npm run db:migrate   # Veritabanını hazırla
npm run db:seed      # Örnek verileri yükle
```

---

## Geliştirme

Pi4'e gerek yok — `localhost:5173` yeterli. Ses macOS'ta `afplay` ile çalışır.

```bash
# Terminal 1: Server
npm run dev:server

# Terminal 2: Web (Yönetici Paneli + Müşteri Ekranı)
npm run dev:web

# Terminal 3: Kasa
cd packages/kasa && npm run dev
```

| Arayüz | URL |
| --- | --- |
| Yönetici Paneli | `http://localhost:5173` |
| Müşteri Ekranı | `http://localhost:5173/display` |
| Admin | `http://localhost:5173/admin` |
| Server (API) | `http://localhost:3000` |

```bash
open http://localhost:5173          # Yönetici Paneli
open http://localhost:5173/display  # Müşteri Ekranı
open http://localhost:5173/admin    # Admin Paneli
open http://localhost:3000/health   # API sağlık
```

Pi4'e sadece teslim veya gerçek ortam testi aşamasında deploy et.

---

## Deploy (Pi4)

```bash
# Bir kez: SSH key kur
ssh-keygen -t ed25519
ssh-copy-id admin@<PI4-IP>

# Kolay deploy için proje köküne .pi4 dosyası oluştur (gitignored):
echo 'admin@<PI4-IP>' > .pi4

# Yeni Pi4 — ilk kurulum (Node.js + systemd + hostname + .env)
bash scripts/deploy.sh --init          # .pi4 dosyası varsa
bash scripts/deploy.sh admin@<PI4-IP> --init  # veya direkt IP ile

# Kod güncellemesi
bash scripts/deploy.sh
```

`deploy.sh` sırasıyla: Mac'te build eder → rsync ile Pi4'e gönderir → migration çalıştırır → servisi restart eder → `/health` kontrolü yapar.

`--init` Pi4 hostname'ini `sepetarasi` yapar → `sepetarasi.local:3000` ile erişim, IP değişse de çalışır.

`deploy.sh` ayrıca systemd drop-in ile `.env` dosyasını servise bağlar ve restart sonrası `AUDIO_ALSA_DEVICE` process env kontrolü yapar (fail-fast).

Kapsamlı test (API + WS + ses):

```bash
bash scripts/pi4-smoke-test.sh
```

**Yeni Pi4 (sıfır cihaz) kuralı:**

1. İlk kez bu cihaza kurulum yapıyorsan mutlaka `--init` kullan.
2. `--init` tamamlandıktan sonra günlük güncellemelerde normal deploy kullan.
3. Cihaza güç + ethernet + 3.5mm hoparlör takıldığında sesin doğru çıkması bu akışla otomatik olmalı.

**`--init` ne zaman tekrar gerekir?**

1. Yeni Pi4 / yeni SD kart / OS reimage yapıldıysa.
2. `sepetarasi.service` silindiyse veya cihazda temel paketler (ör. `mpg123`) yoksa.
3. Hostname veya 3.5mm audio route ayarları bozulduysa.

`--init` tekrar çalıştırmak genelde güvenlidir, sadece normal deploy'dan daha uzun sürer.

**Müşteriye kurulum akışı:**

1. Pi4'ü restoranın WiFi'ına bağla, geçici IP'yi öğren (`arp -a` veya router paneli)
2. `bash scripts/deploy.sh admin@<geçici-IP> --init` → her şey otomatik kurulur
3. Restoranda güncelleme gerektiğinde sadece `bash scripts/deploy.sh admin@<cihaz-IP>` çalıştır
4. Uygulama URL'leri: `http://sepetarasi.local:3000` ve `http://sepetarasi.local:3000/display`

---

## Servis Yönetimi (Pi4)

```bash
# Pi4 üzerinde:
sudo systemctl status sepetarasi
sudo systemctl restart sepetarasi
journalctl -u sepetarasi -f

# Mac'ten uzaktan:
ssh admin@<PI4-IP> "sudo journalctl -u sepetarasi -f"
```

---

## Kasa (Electron)

```bash
# Dev modu (Terminal 3):
cd packages/kasa && npm run dev

# macOS .app build:
cd packages/kasa && npm run build
open "$PWD/release/mac-arm64/Sepetarasi Kasa.app"

# Windows .exe build (Mac üzerinde cross-compile):
cd packages/kasa && npm run build:win
```

> **İkon Güncelleme:** Marka ikonunu değiştirmek isterseniz `packages/kasa/build/icon.png` dosyasını değiştirip `./scripts/generate-icons.sh` scriptini çalıştırmanız yeterlidir.

---

## Kalite Kontrolü

```bash
npm run ci           # lint + typecheck + test — commit öncesi çalıştır
npm run lint:fix     # Biome ile otomatik biçimlendirme
```

Test stratejisi:

```bash
npm run test:unit         # hızlı geri bildirim (audio-playback + broadcaster)
npm run test:integration  # API + DB + worker akış testleri
npm run test:coverage     # coverage raporu + threshold kontrolü (>=80)
npm run test:smoke:pi4    # Pi4 release-gate smoke testi (API + WS + ses)
```

Önerilen kullanım:

1. Günlük geliştirme: `npm run test:unit`
2. Main'e commit/push öncesi: `npm run ci` + `npm run test:coverage`
3. Müşteriye gitmeden önce: Pi4 üzerinde `npm run test:smoke:pi4`

### Release Gate (MVP)

Müşteriye çıkmadan önce Pi4 üzerinde aşağıdaki smoke test zorunludur:

```bash
bash scripts/pi4-smoke-test.sh
```

Bu gate manueldir (MVP): CI'da hard-blocking zorunluluk yoktur.

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
JWT_SECRET=replace-with-strong-secret                          # production'da zorunlu
COOKIE_SECRET=replace-with-strong-secret                       # production'da zorunlu
CASHIER_TOKEN=replace-with-strong-token                        # production'da zorunlu
ANNOUNCEMENTS_PATH=./packages/server/assets/announcements   # opsiyonel
AUDIO_ALSA_DEVICE=hw:2,0                                    # Pi4 ses çıkış cihazı (3.5mm jack)
DISABLE_AUDIO=false                                         # sesi kapatmak için true
ENABLE_TTS_FALLBACK=false                                   # MP3 yoksa TTS devreye girer
WS_AUTH_KEY=replace-with-strong-key                            # WebSocket için zorunlu
```

---

## Sesli Anons (Pi4)

Pre-recorded MP3 zorunlu (`1.mp3` … `400.mp3`), TTS fallback varsayılan kapalı.

```bash
npm run audio:generate   # 400 adet MP3 üret (macOS, say + ffmpeg gerekli)
```

Ses cihazı: `AUDIO_ALSA_DEVICE=hw:2,0` → 3.5mm jack. Pi4'te hangi cihazın hangi index olduğunu görmek için: `aplay -l`

Ses çıkışını 3.5mm jack'e zorlamak: `sudo raspi-config nonint do_audio 1`
