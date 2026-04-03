# Sepetarasi Order Tracking

LAN tabanli restoran siparis takip sistemi. Kasa (Electron .exe), Dashboard ve Musteri Ekrani (web).

## Kurulum

```bash
npm install
npm run db:migrate
npm run db:seed
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

## Kasa .exe Build

```bash
cd packages/kasa && npm run build:win
# Cikti: packages/kasa/release/
```

## Pi4 Deploy (rsync)

Mac'te build edip Pi4'e gonderir. Her guncelleme icin tekrarlanir:

```bash
# 1. Mac'te build
npm run build

# 2. Pi4'e gonder (kasa haric, dist dahil)
rsync -az --delete \
  --exclude node_modules --exclude .git --exclude 'packages/kasa' \
  --exclude '*.db' --exclude '*.db-wal' --exclude '*.db-shm' \
  --exclude .env --exclude dist-electron --exclude release \
  ./ admin@192.168.1.34:/opt/sepetarasi/

# 3. Pi4'de migration + restart
ssh admin@192.168.1.34 "cd /opt/sepetarasi && \
  cp -r packages/server/src/db/migrations packages/server/dist/db/migrations && \
  npm install --omit=dev && \
  DB_PATH=/opt/sepetarasi/data/sepetarasi.db node packages/server/dist/db/migrate.js && \
  sudo systemctl restart sepetarasi"
```

Dashboard: `http://192.168.1.34:3000`
Musteri ekrani: `http://192.168.1.34:3000/display`

## API

| Method | Endpoint | Aciklama |
|--------|----------|----------|
| POST | `/api/v1/orders` | Siparis olustur |
| GET | `/api/v1/orders` | Gunun siparisleri |
| PATCH | `/api/v1/orders/:id/status` | Durum degistir |
| GET | `/api/v1/stats/today` | Istatistikler |
| GET | `/api/v1/settings` | Ayarlar (readonly) |
| WS | `/ws?channel=orders` | Canli guncellemeler |
| WS | `/ws?channel=display` | Anons olaylari |

## Ortam Degiskenleri

```
PORT=3000
DB_PATH=./data/sepetarasi.db
STORE_TIMEZONE=Europe/Istanbul
```
