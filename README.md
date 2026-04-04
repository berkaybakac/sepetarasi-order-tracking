# Sepetarasi Order Tracking

LAN tabanli restoran siparis takip sistemi. Kasa (Electron .exe), Dashboard ve Musteri Ekrani (web).

## Kurulum

```bash
npm install
npm run db:migrate
npm run db:seed
```

## Kalite Kontrolu

```bash
npm run ci               # lint + typecheck + test (commit oncesi calistir)
npm run test:coverage    # kapsam raporu (esik packages/server/vitest.config.ts dosyasinda tanimli)
npm run lint:fix         # otomatik bicimlendirme
```

## Gelistirme

```bash
# Terminal 1: Server
npm run dev:server

# Terminal 2: Web (Dashboard + Musteri Ekrani)
npm run dev:web

# Terminal 3: Kasa (opsiyonel)
cd packages/kasa && npm run dev
```

## Production Build + Calistirma

```bash
npm run build
npm start
# http://localhost:3000
```

## Kasa — Gelistirme ve Test

**macOS'ta Electron olarak acmak (gelistirme / gorsel test):**

```bash
cd packages/kasa && npm run dev
# Electron macOS'ta acilir; server URL'sini Pi4 IP veya localhost gir
```

**macOS .app build:**

```bash
cd packages/kasa && npm run build
# Cikti: packages/kasa/release/mac-arm64/
```

**Windows .exe build (Mac uzerinde cross-compile):**

```bash
cd packages/kasa && npm run build:win
# Cikti: packages/kasa/release/
```

> Dashboard ve musteri ekrani her iki platformda da tarayicidan eriselebilir:
> `http://<sunucu-ip>:3000` ve `http://<sunucu-ip>:3000/display`

## Deploy (Pi4)

Iki yontem var:

**A) Mac'ten uzaktan (tek komut)** — SSH ile build + gonder + restart:

```bash
# Onkosul: ssh-copy-id admin@<IP>

# Yeni Pi4 (ilk kurulum)
bash scripts/deploy.sh admin@192.168.1.34 --init

# Guncelleme
bash scripts/deploy.sh admin@192.168.1.34
```

**B) Pi4 uzerinde yerelde** — dosyalar zaten Pi4'te ise:

```bash
# Pi4'e SSH ile baglan, proje dizinine gir
bash scripts/pi4-deploy.sh
```

## API

| Method | Endpoint | Aciklama |
| ------ | -------- | -------- |
| POST | `/api/v1/orders` | Siparis olustur |
| GET | `/api/v1/orders` | Gunun siparisleri |
| PATCH | `/api/v1/orders/:id/status` | Durum degistir |
| GET | `/api/v1/stats/today` | Istatistikler |
| GET | `/api/v1/settings` | Ayarlar (readonly) |
| WS | `/ws?channel=orders` | Canli guncellemeler |
| WS | `/ws?channel=display` | Anons olaylari |

## Sesli Anons Kurulumu (Pi4)

Servis her "Hazır" siparişi için otomatik anons yapar. İki yöntem:

**A) Pre-recorded ses dosyaları (önerilen):**

`packages/server/assets/announcements/` dizinine `1.mp3`, `2.mp3`, ..., `400.mp3` dosyalarını koy.
Çalma sırası: `mpg123` (Linux) / `afplay` (macOS)

**B) TTS fallback (kurulum gerektirmez):**

`espeak-ng` (Pi4'te otomatik kurulu) Türkçe seslendirme yapar.
Ses dosyası bulunamazsa otomatik devreye girer.

Ses çıkışı için Pi4'te: `sudo raspi-config nonint do_audio 1` (3.5mm jack)

## Ortam Degiskenleri

```env
PORT=3000
DB_PATH=./data/sepetarasi.db
STORE_TIMEZONE=Europe/Istanbul
ANNOUNCEMENTS_PATH=./packages/server/assets/announcements   # opsiyonel, default bu
DISABLE_AUDIO=false                                          # opsiyonel
```
