# Engineering Guardrails

This file contains only repository-specific, long-lived decisions and guardrails.
General commit hygiene and scope discipline remain team working norms and are not repeated here.

## 1. Intentional Separation: web vs kasa API clients

`packages/web/src/lib/api.ts` and `packages/kasa/src/lib/api.ts` are intentionally separate and must not be merged into a single client.

Why:

- `web` is the browser admin UI; it relies on same-origin behavior and the Vite proxy assumption.
- `kasa` is the Electron application; it carries a runtime `baseUrl`, a LAN IP, and a request-scoped `terminalId`.
- A shared client would leak Electron-specific connection behavior into the browser bundle.

Re-evaluate this only if:

- the `web` side starts requiring write paths
- Electron is removed

## 2. Feature Delivery Order

When adding a new feature across packages, the delivery order should be:

1. `packages/shared/src`
2. server route + service
3. `web` / `kasa` store
4. UI

Why:

- Types and contracts are defined first.
- The compiler catches missing implementations across packages immediately.
- This reduces the kind of drift where something "works on web, but is broken on kasa."

## 3. Windows Validation Gate

Because Windows is the target production environment, the following changes require same-day Windows smoke/E2E validation even if day-to-day development happens on macOS:

- `packages/kasa/electron`
- installer changes and `npm run build:win` outputs
- hotkey, printer, file path/save, and connection/reconnect flows

Before a release, run the manual Windows checklist; before production rollout, validate again on a real Windows device.
