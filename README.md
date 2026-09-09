# SepetArası — Restaurant Order Tracking

**Restaurant ordering, cashier applications and customer displays connected over a local network.**

Live at **1 restaurant**, confirmed 8 September 2026. I built and maintain the system as the sole software developer at Statek Stabil Teknoloji, from requirements and implementation through deployment and field support.

The product connects an Electron cashier application, a React administration panel and customer displays through a TypeScript/Fastify backend. WebSocket updates keep supported clients synchronized; a dedicated HTML renderer supports constrained display hardware.

[Engineering highlights](#key-engineering-highlights) · [Local setup](#quick-local-setup) · [Testing](#quality-signals) · [Field operations](#field-operations)

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Electron](https://img.shields.io/badge/Electron-191970?style=flat&logo=Electron&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-000000?style=flat&logo=fastify&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-07405E?style=flat&logo=sqlite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=flat&logo=node.js&logoColor=white)
![Raspberry Pi](https://img.shields.io/badge/Raspberry%20Pi-C51A4A?style=flat&logo=Raspberry-Pi&logoColor=white)
[![License](https://img.shields.io/badge/License-Source%20Available-orange?style=flat)](LICENSE)

## Key Engineering Highlights

- **Hardware compatibility under embedded browser constraints:** The TB1 LED display panel could not reliably boot a React SPA due to its limited embedded browser runtime. Diagnosed the failure, then built a single file, polling based compatibility display that works reliably within the device's actual capabilities. Validated in the field.

- **Recovery after connection loss:** Reconnect/snapshot recovery tests cover clients catching up on order state after missed events.

- **Database query design:** Order-item loading uses a batched query instead of querying separately for every order.

- **Audio ducking system:** Announcement audio lowers background music, then restores it after the announcement ends.

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

Default admin credentials are set in the seed file. Change before any real deployment.

## Configuration Notes

- `WS_AUTH_KEY` on the server must match `VITE_WS_AUTH_KEY` in both client apps. If they drift, authenticated WebSocket channels will fail silently.
- `CASHIER_TOKEN` is the cashier app credential. The default dev value is set in `.env.example`; the cashier app reads this to authenticate against the server.
- `STORE_TIMEZONE` affects business-date logic and stats aggregation. Defaults to `Europe/Istanbul`.
- Production requires strong `JWT_SECRET`, `COOKIE_SECRET`, and `CASHIER_TOKEN` values.

## Field Operations

- Pi4 field stabilization and health-check runbook: [`docs/pi4-field-stabilization-runbook.md`](docs/pi4-field-stabilization-runbook.md)

## Quality Signals

```bash
npm run ci
npm run test:coverage
```

`npm run ci` runs lint, typecheck, and the full test suite across all packages. `npm run test:coverage` reports coverage for the server package, which includes route, WebSocket, printer, and audio test suites.

## License

This repository is source-available. You may view, clone, run, and privately modify it for personal evaluation, portfolio review, and other non-commercial reference purposes only.

Production use, commercial use, redistribution, and reuse of substantial portions require prior written permission. See [LICENSE](LICENSE).
