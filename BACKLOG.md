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

**Neden:** Windows kalite kapısı şu an manuel checklist'e bağlı. Otomasyon, regression'ları release öncesinde daha erken yakalar.

**Nasıl yapılır:**
1. `windows-latest` runner'da `npm run build:win` adımını CI'ya ekle
2. Kasa uygulaması için temel smoke senaryolarını otomatikleştir (açılış, bağlantı, sipariş akışı, reconnect, config kalıcılık)
3. Manuel checklist'i (`scripts/win-exe-smoke-test.md`) otomasyon kapsamı dışında kalan adımlar için koru

**Öncelik:** Orta — MVP'de manuel gate yeterli, release sayısı arttıkça otomasyon kritik hale gelir.
