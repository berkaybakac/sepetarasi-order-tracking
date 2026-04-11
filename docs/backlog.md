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

### 4) Rate Limit Stratejisi (100 -> 300 degisikligi) + 429 Operasyon Etkisi
- Durum: Backlog (simdilik kod degistirme yok, commit oncesi not alindi)
- Oncelik: P1
- Kapsam:
  - `/packages/server/src/app.ts` (`fastify-rate-limit` max degeri)
  - `/packages/kasa/src/stores/orderStore.ts` (429 alinca retry davranisi)
- Problem:
  - Global rate-limit degeri `100/dk` iken `300/dk` yapildi; guvenlik etkisi (abuse/bruteforce surface) tekrar degerlendirilmeli.
  - Kasa tarafinda 429 durumunda hydrate retry zinciri erken kesiliyor; operasyon aninda gecici yogunlukta "bekliyor gibi" algisi olusabilir.
- Acik Sorular (prod oncesi karar):
  - Limit `100`, `300` ya da farkli bir deger mi olmali?
  - Global limit yerine route/rol bazli limit gerekir mi? (ornegin auth / orders / stats ayrimi)
  - Anahtar stratejisi ne olmali? (IP, terminal_id, cashier token, hibrit)
  - Operasyon hizi vs guvenlik dengesi icin hedef metrik nedir? (429 orani, siparis olusturma gecikmesi, reconnect/hydrate suresi)
  - Bu karar yalnizca konfig degisikligi ile mi cozulur, yoksa orta olcekte refactor gerekir mi?
- Release Gate: Prod oncesi zorunlu inceleme ve karar.

### 5) SEPET ARASI Isim/Logo Icin Tam SSoT
- Durum: Backlog (simdilik aksiyon yok)
- Oncelik: P2
- Kapsam:
  - UI brand metinleri
  - Electron window title
  - `/packages/kasa/index.html` title
  - `/packages/kasa/package.json` (`productName`, ilgili metadata)
- Problem: Isim/logo birden fazla yerde elle yonetiliyor; degisiklikte drift riski var.
- Hedef: Tek kaynaktan uretim (brand config/build step) ile UI + desktop metadata senkronu.
- Not: Push/merge bloklayici degil; MVP akisini durdurmaz.
