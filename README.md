![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Electron](https://img.shields.io/badge/Electron-191970?style=flat&logo=Electron&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-000000?style=flat&logo=fastify&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-07405E?style=flat&logo=sqlite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=flat&logo=node.js&logoColor=white)
![Raspberry Pi](https://img.shields.io/badge/Raspberry%20Pi-C51A4A?style=flat&logo=Raspberry-Pi&logoColor=white)
[![License](https://img.shields.io/badge/License-Source%20Available-orange?style=flat)](LICENSE)

# SEPET ARASI: Order Tracking

Full-stack restaurant order tracking system, live in production.

A multi surface system built for a single restaurant location: a desktop cashier app, a customer facing order status display, an admin panel, and a backend, all synchronized in real time over WebSocket. Designed, built, and deployed by a single developer. The system is live and actively used in the field.

<!-- TODO: add screenshot or demo GIF here (admin panel + cashier app + customer display side by side) -->

## Key Engineering Highlights

- **Hardware compatibility under embedded browser constraints:** The TB1 LED display panel could not reliably boot a React SPA due to its limited embedded browser runtime. Diagnosed the failure, then built a single file, polling based compatibility display that works reliably within the device's actual capabilities. Validated in the field.

- **Audio ducking system:** Announcement audio smoothly fades out background music, then restores it after the announcement ends. The fade curve and timing were validated through on-site listening tests. Entirely custom logic, no library.

- **LAN first Pi4 production deployment:** The Fastify backend, built web assets, and WebSocket server all run on a Raspberry Pi 4 on the store's local network. No cloud dependency. The deploy pipeline targets ARM64 and accounts for ALSA audio configuration and systemd service management.

## What's Inside

| Package | Role |
| --- | --- |
| `packages/server` | Fastify API, WebSocket server, auth, stats, settings, audio, storage |
| `packages/web` | React/Vite admin panel and customer display |
| `packages/kasa` | Electron cashier client for macOS/Windows |
| `packages/shared` | Single source of truth for types, routes, constants, display settings, helpers |

## Tech Stack

Fastify · WebSocket · Drizzle ORM · SQLite · React 19 · Vite · Zustand · Electron · TypeScript

## Quick Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create local env files

```bash
cp packages/server/.env.example packages/server/.env
cp packages/web/.env.example packages/web/.env
cp packages/kasa/.env.example packages/kasa/.env
```

### 3. Initialize the database

```bash
npm run db:migrate
npm run db:seed
```

### 4. Start the app surfaces

```bash
# Terminal 1
npm run dev:server

# Terminal 2
npm run dev:web

# Terminal 3
cd packages/kasa && npm run dev
```

### 5. Open the local URLs

- Admin UI: `http://localhost:5173/admin`
- Customer display: `http://localhost:5173/display`
- API: `http://localhost:3000`

Local admin login starts with `admin123` if no password hash exists yet. Change before any real deployment.

## Configuration Notes

- `WS_AUTH_KEY` on the server must match `VITE_WS_AUTH_KEY` in both client apps. If they drift, authenticated WebSocket channels will fail silently.
- `CASHIER_TOKEN` is the cashier app credential. Local dev defaults to `http://localhost:3000`.
- `STORE_TIMEZONE` affects business-date logic and stats aggregation. Defaults to `Europe/Istanbul`.
- Production requires strong `JWT_SECRET`, `COOKIE_SECRET`, and `CASHIER_TOKEN` values.

## Quality Signals

```bash
npm run ci
npm run test:coverage
```

Test coverage spans `server`, `web`, `kasa`, and `shared`, including route, UI, reconnection, printer, and audio test suites.

## License

This repository is source-available. You may view, clone, run, and privately modify it for personal evaluation, portfolio review, and other non-commercial reference purposes only.

Production use, commercial use, redistribution, and reuse of substantial portions require prior written permission. See [LICENSE](LICENSE).
