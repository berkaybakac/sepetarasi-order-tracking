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

## Pi4 Deploy

```bash
bash scripts/pi4-deploy.sh
```

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
```
