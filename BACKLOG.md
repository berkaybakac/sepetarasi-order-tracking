# Backlog

MVP sonrası ertelenen iyileştirmeler. Öncelik sırası yaklaşık.

---

## Deploy / Pi4

### [ ] pi4-deploy.sh: build sonrası dev deps prune et

**Neden:** `npm ci` ile kurulan dev deps (typescript, vite, tsx, test araçları ~300-500MB)
build sonrası Pi4'te gereksiz kalıyor. Runtime'ı etkilemez ama SD kart dolma riskini artırır.

**Nasıl yapılır:**
1. Build + migration copy adımından sonra `npm prune --omit=dev` ekle
2. `npm run db:migrate` ve `npm run db:seed` adımlarını kaldır
   (tsx prune sonrası çalışmaz; server startup zaten migrate ediyor, seed idempotent)
3. Test: `bash scripts/pi4-smoke-test.sh`

**Öncelik:** Düşük-Orta — 7/24 çalışan production Pi4'te 6-12 ay sonra disk alanı için önem kazanır.

---

## QA / Windows

### [ ] Windows validation otomasyonu (Playwright/Windows runner)

**Neden:** Windows kalite kapisi su an manuel checklist'e bagli. Otomasyon, regressions'i release oncesinde daha erken yakalar.

**Nasil yapilir:**
1. `windows-latest` runner'da `npm run build:win` adimini CI'ya ekle
2. Kasa uygulamasi icin temel smoke senaryolari otomatiklestir (acilis, baglanti, siparis akisi, reconnect, config kalicilik)
3. Manuel checklist'i (`scripts/win-exe-smoke-test.md`) otomasyon kapsami disinda kalan adimlar icin koru

**Oncelik:** Orta — MVP'de manuel gate yeterli, release sayisi arttikca otomasyon kritik hale gelir.
