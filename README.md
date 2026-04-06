# Sepetarasi Order Tracking

LAN tabanlı restoran sipariş takip sistemi — Kasa (Electron), Dashboard ve Müşteri Ekranı.

---

## Erişim

Sunucu çalışırken tüm arayüzler `http://<PI4-IP>:3000` üzerinden erişilebilir:

| Arayüz | URL |
| --- | --- |
| Dashboard | `http://<PI4-IP>:3000` |
| Müşteri Ekranı | `http://<PI4-IP>:3000/display` |
| Admin | `http://<PI4-IP>:3000/admin` |
| Sağlık | `http://<PI4-IP>:3000/health` |

macOS'tan Pi4 arayüzlerini açmak için:

```bash
open http://<PI4-IP>:3000
open http://<PI4-IP>:3000/display
open http://<PI4-IP>:3000/admin
open http://<PI4-IP>:3000/health
```

Windows'ta URL açma komutu: `start http://<PI4-IP>:3000`

---

## İlk Kurulum (geliştirme makinesi)

```bash
npm install
npm run db:migrate
npm run db:seed
```

---

## Geliştirme

```bash
# 3 ayrı terminal aç:

# Terminal 1: Server
npm run dev:server

# Terminal 2: Web (Dashboard + Müşteri Ekranı)
npm run dev:web

# Terminal 3: Kasa (opsiyonel)
cd packages/kasa && npm run dev
```

Yerel erişim (Vite dev):

| Arayüz | URL |
| --- | --- |
| Dashboard | `http://localhost:5173` |
| Müşteri Ekranı | `http://localhost:5173/display` |
| Admin | `http://localhost:5173/admin` |
| Server (API) | `http://localhost:3000` |

macOS'ta local geliştirme arayüzlerini açmak için:

```bash
open http://localhost:5173
open http://localhost:5173/display
open http://localhost:5173/admin
open http://localhost:3000/health
```

Not: `localhost:5173` Vite geliştirme sunucusudur (Mac'te çalışan canlı kod).
`http://<PI4-IP>:3000` ise Pi4 üzerindeki deploy edilmiş build'dir.
Ekranlar aynı görünebilir; kaynakları farklıdır.

---

## Deploy (Pi4)

**A) Mac'ten — SSH ile build + gönder + yeniden başlat:**

```bash
# Bir kez: SSH key kur
ssh-keygen -t ed25519
ssh-copy-id admin@<PI4-IP>

# Yeni Pi4 (ilk kurulum — Node.js + systemd + .env dahil)
bash scripts/deploy.sh admin@<PI4-IP> --init

# Kod güncellemesi
bash scripts/deploy.sh admin@<PI4-IP>
```

**B) Pi4 üzerinde yerelde:**

```bash
bash scripts/pi4-deploy.sh
```

Deploy sonrası `deploy.sh` otomatik `/health` kontrolü yapar. Daha kapsamlı test (API + WS + ses):

```bash
bash scripts/pi4-smoke-test.sh
```

---

## Servis Yönetimi (Pi4)

Pi4 içine SSH olduktan sonra:

```bash
sudo systemctl status sepetarasi
sudo systemctl restart sepetarasi
journalctl -u sepetarasi -f
```

Mac'ten uzaktan:

```bash
ssh admin@<PI4-IP> "sudo systemctl status sepetarasi --no-pager"
ssh admin@<PI4-IP> "sudo journalctl -u sepetarasi -f"
```

---

## Kasa (Electron)

**macOS .app build ve açma:**

```bash
cd packages/kasa && npm run build
# Çıktı: packages/kasa/release/mac-arm64/

open -a "Sepetarasi Kasa"
# veya doğrudan:
open "$PWD/release/mac-arm64/Sepetarasi Kasa.app"
```

**Windows .exe build (Mac üzerinde cross-compile):**

```bash
cd packages/kasa && npm run build:win
# Çıktı: packages/kasa/release/
```

Windows doğrulama politikası: `docs/dev-notes.md` → Windows Validation Gate

---

## Production Build (yerel test)

Pi4'e deploy için `deploy.sh` kullan. Bu komutlar yalnızca yerel makine testi içindir:

```bash
npm run build
npm start
```

---

## Kalite Kontrolü

```bash
npm run ci               # lint + typecheck + test — commit öncesi çalıştır
npm run test:coverage    # kapsam raporu (eşik packages/server/vitest.config.ts'de)
npm run lint:fix         # otomatik biçimlendirme
```

---

## API

| Method | Endpoint | Açıklama |
| --- | --- | --- |
| POST | `/api/v1/orders` | Sipariş oluştur |
| GET | `/api/v1/orders` | Günün siparişleri |
| PATCH | `/api/v1/orders/:id/status` | Durum değiştir |
| GET | `/api/v1/stats/today` | İstatistikler |
| GET | `/api/v1/settings` | Ayarlar (readonly) |
| WS | `/ws?channel=orders` | Canlı güncellemeler |
| WS | `/ws?channel=display` | Anons olayları |

---

## Ortam Değişkenleri

```env
PORT=3000
DB_PATH=./data/sepetarasi.db
STORE_TIMEZONE=Europe/Istanbul
ANNOUNCEMENTS_PATH=./packages/server/assets/announcements   # opsiyonel
DISABLE_AUDIO=false                                         # sesi kapatmak için true yap
ENABLE_TTS_FALLBACK=false                                   # MVP: false (sadece pre-recorded mp3)
```

---

## Sesli Anons (Pi4)

MVP politikası: pre-recorded ses zorunlu (`1.mp3` … `400.mp3`), TTS fallback varsayılan kapalıdır.
Windows kasa cihazları sadece API çağrısı yapar; gerçek ses çıkışı yalnızca Pi4 sunucuda gerçekleşir.
MP3 dosyaları repoya commit edilmez (`.gitignore` ile hariç tutulur).

1. Ses dosyalarını üret:
   `npm run audio:generate`
2. Dosyaları doğrula:
   `npm run audio:validate`
3. Çalma: Linux'ta `mpg123`, macOS'ta `afplay`.
4. TTS (opsiyonel): `ENABLE_TTS_FALLBACK=true` yapılırsa, ses dosyası yokken `espeak-ng/say` devreye girer.

Ses çıkışı (3.5mm jack): `sudo raspi-config nonint do_audio 1`
