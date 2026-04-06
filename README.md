# Sepetarasi Order Tracking

LAN tabanlı restoran sipariş takip sistemi — Kasa (Electron), Dashboard ve Müşteri Ekranı.

---

## Erişim (Pi4)

`--init` ile kurulumdan sonra aynı ağdaki tüm cihazlar hostname ile bağlanır:

| Arayüz | URL |
| --- | --- |
| Dashboard | `http://sepetarasi.local:3000` |
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

## İlk Kurulum (geliştirme makinesi)

```bash
npm install
npm run db:migrate
npm run db:seed
```

---

## Geliştirme

Pi4'e gerek yok — `localhost:5173` yeterli. Ses macOS'ta `afplay` ile çalışır.

```bash
# Terminal 1: Server
npm run dev:server

# Terminal 2: Web (Dashboard + Müşteri Ekranı)
npm run dev:web

# Terminal 3: Kasa (opsiyonel)
cd packages/kasa && npm run dev
```

| Arayüz | URL |
| --- | --- |
| Dashboard | `http://localhost:5173` |
| Müşteri Ekranı | `http://localhost:5173/display` |
| Admin | `http://localhost:5173/admin` |
| Server (API) | `http://localhost:3000` |

```bash
open http://localhost:5173          # Dashboard
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

Kapsamlı test (API + WS + ses):

```bash
bash scripts/pi4-smoke-test.sh
```

**Müşteriye kurulum akışı:**

1. Pi4'ü restoranın WiFi'ına bağla, geçici IP'yi öğren (`arp -a` veya router paneli)
2. `bash scripts/deploy.sh admin@<geçici-IP> --init` → her şey otomatik kurulur
3. Bundan sonra `http://sepetarasi.local:3000` — IP değişse de çalışır

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

---

## Kalite Kontrolü

```bash
npm run ci           # lint + typecheck + test — commit öncesi çalıştır
npm run lint:fix     # otomatik biçimlendirme
```

---

## API

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

## Ortam Değişkenleri

```env
PORT=3000
DB_PATH=./data/sepetarasi.db
STORE_TIMEZONE=Europe/Istanbul
ANNOUNCEMENTS_PATH=./packages/server/assets/announcements   # opsiyonel
AUDIO_ALSA_DEVICE=hw:2,0                                    # Pi4 ses çıkış cihazı (3.5mm jack)
DISABLE_AUDIO=false                                         # sesi kapatmak için true
ENABLE_TTS_FALLBACK=false                                   # MP3 yoksa espeak-ng/say devreye girer
```

---

## Sesli Anons (Pi4)

Pre-recorded MP3 zorunlu (`1.mp3` … `400.mp3`), TTS fallback varsayılan kapalı.
MP3 dosyaları repoya commit edilmez — deploy öncesi üretilmeli.

```bash
npm run audio:generate   # 400 adet MP3 üret (macOS, say + ffmpeg gerekli)
```

Ses cihazı: `AUDIO_ALSA_DEVICE=hw:2,0` → 3.5mm jack. Pi4'te hangi cihazın hangi index olduğunu görmek için: `aplay -l`

Ses çıkışını 3.5mm jack'e zorlamak: `sudo raspi-config nonint do_audio 1`
