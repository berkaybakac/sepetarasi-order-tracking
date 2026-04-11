# Backlog

Bu dosya, feature gelistirmeyi bloklamayan ama teknik borc birikimini kontrol altinda tutmak icin takip edilen maddeleri icerir.

## Aktif Teknik Borc Maddeleri

### 1) WebSocket Hook Tekillestirme (`web` / `kasa`)
- Durum: Backlog (simdilik aksiyon yok)
- Oncelik: P1
- Kapsam:
  - `/packages/web/src/hooks/useWebSocket.ts`
  - `/packages/kasa/src/hooks/useWebSocket.ts`
- Problem: Iki hook buyuk olcude kopya; WS davranisi degistikce drift/bug riski artar.
- Tetikleyici (zorunlu ele al): WS tarafinda ilk davranis degisikligi (reconnect, auth, event/payload akisi vb.) yapilacagi PR.
- Not: API client ayrimi gibi ADR ile bilincli bir ayrim degil, teknik borc olarak izleniyor.

### 2) CORS Origin Reflection Sinirlandirma
- Durum: Backlog (simdilik aksiyon yok)
- Oncelik: P1
- Kapsam:
  - `/packages/server/src/app.ts` (CORS header set edilen bolum)
- Problem: Gelen `Origin` degerinin dogrudan yansitilmasi guvenlik borcu biriktirir.
- Plan: Allowlist tabanli origin kontrolu (env/config ile yonetilen izinli origin listesi).
- Release Gate: Prod oncesi zorunlu tamamlanacak.

### 3) `BasketIcon` Tekillestirme (`web` / `kasa`)
- Durum: Backlog (simdilik aksiyon yok)
- Oncelik: P2
- Kapsam:
  - `/packages/web/src/components/BasketIcon.tsx`
  - `/packages/kasa/src/components/BasketIcon.tsx`
- Problem: Birebir kopya component.
- Karar: Dusuk risk/dusuk etki; UI/branding cleanup sirasinda ele alinacak.
