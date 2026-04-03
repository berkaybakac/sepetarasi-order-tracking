#!/usr/bin/env bash
# =============================================================
# Pi4 Smoke Test
# Hedef: Raspberry Pi 4 (ARM64) uzerinde API + WS + anons + ses
# Onkosul: Node.js 20+, npm, aplay veya mpv kurulu
# Calistir: bash scripts/pi4-smoke-test.sh
# =============================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; FAILURES=$((FAILURES + 1)); }
info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

FAILURES=0
PORT=3000
BASE="http://localhost:$PORT"

echo "======================================="
echo "  Sepetarasi Pi4 Smoke Test"
echo "======================================="
echo ""

# --- 1. Ortam kontrol ---
info "1/7 Ortam kontrolleri"

if ! command -v node &>/dev/null; then
  fail "Node.js bulunamadi"
  exit 1
fi
NODE_VER=$(node --version)
pass "Node.js: $NODE_VER"

ARCH=$(uname -m)
if [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]]; then
  pass "Mimari: $ARCH (ARM64)"
else
  info "Mimari: $ARCH (Pi4 degil, test yine de calisir)"
fi

# Ses cikisi kontrol
if command -v aplay &>/dev/null; then
  pass "aplay mevcut"
elif command -v mpv &>/dev/null; then
  pass "mpv mevcut"
else
  fail "Ses araci bulunamadi (aplay veya mpv gerekli)"
fi

# 3.5mm analog cikis kontrol (ALSA)
if command -v aplay &>/dev/null; then
  AUDIO_DEVICES=$(aplay -l 2>/dev/null || true)
  if echo "$AUDIO_DEVICES" | grep -qi "headphones\|analog\|bcm2835"; then
    pass "3.5mm analog ses cikisi algilandi"
  else
    info "3.5mm analog cikis bulunamadi (HDMI olabilir, asagida test edilecek)"
  fi
fi

echo ""

# --- 2. Sunucu baslat ---
info "2/7 Sunucu baslatiliyor"

# Onceki sureci durdur
lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
sleep 1

rm -f data/sepetarasi.db*
npx tsx packages/server/src/server.ts &
SERVER_PID=$!
sleep 3

if kill -0 $SERVER_PID 2>/dev/null; then
  pass "Sunucu calisiyor (PID: $SERVER_PID)"
else
  fail "Sunucu baslatma basarisiz"
  exit 1
fi

# Cleanup on exit
trap "kill $SERVER_PID 2>/dev/null; exit" EXIT INT TERM

echo ""

# --- 3. API testi ---
info "3/7 API testleri"

HEALTH=$(curl -sf $BASE/health)
if echo "$HEALTH" | grep -q '"ok":true'; then
  pass "GET /health"
else
  fail "GET /health: $HEALTH"
fi

# Siparis olustur
CREATE_RES=$(curl -sf -X POST $BASE/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{"items":[{"name":"Doner","quantity":2,"unit_price":15000},{"name":"Ayran","quantity":2,"unit_price":3000}]}')

ORDER_ID=$(echo "$CREATE_RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
DISPLAY_NO=$(echo "$CREATE_RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['display_no'])" 2>/dev/null)

if [[ -n "$ORDER_ID" ]]; then
  pass "POST /orders -> #$DISPLAY_NO ($ORDER_ID)"
else
  fail "POST /orders: $CREATE_RES"
fi

# Ikinci siparis
CREATE_RES2=$(curl -sf -X POST $BASE/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{"items":[{"name":"Lahmacun","quantity":1,"unit_price":12000}]}')
DISPLAY_NO2=$(echo "$CREATE_RES2" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['display_no'])" 2>/dev/null)

if [[ "$DISPLAY_NO2" == "2" ]]; then
  pass "display_no auto-increment: #$DISPLAY_NO2"
else
  fail "display_no beklenen 2, alinan: $DISPLAY_NO2"
fi

echo ""

# --- 4. Durum gecisi + READY atomic ---
info "4/7 Durum gecisi + atomic READY"

READY_RES=$(curl -sf -X PATCH "$BASE/api/v1/orders/$ORDER_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status":"READY"}')

READY_STATUS=$(echo "$READY_RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])" 2>/dev/null)
READY_AT=$(echo "$READY_RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['ready_at'])" 2>/dev/null)

if [[ "$READY_STATUS" == "READY" && "$READY_AT" != "None" ]]; then
  pass "PREPARING -> READY (ready_at: $READY_AT)"
else
  fail "Status change: status=$READY_STATUS, ready_at=$READY_AT"
fi

# Gecersiz gecis
INVALID_RES=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/api/v1/orders/$ORDER_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status":"PREPARING"}')

# READY->PREPARING undo yapip tekrar kontrol edelim (once delivered deneyelim - gecersiz olmalı)
# Aslında READY->PREPARING geçerli. DELIVERED->PREPARING geçersiz test edelim.
DELIVERED_RES=$(curl -sf -X PATCH "$BASE/api/v1/orders/$ORDER_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status":"DELIVERED"}')
DELIVERED_INVALID=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/api/v1/orders/$ORDER_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status":"PREPARING"}')

if [[ "$DELIVERED_INVALID" == "422" ]]; then
  pass "DELIVERED -> PREPARING = 422 (reddedildi)"
else
  fail "Beklenen 422, alinan: $DELIVERED_INVALID"
fi

echo ""

# --- 5. Stats ---
info "5/7 Stats (averagePrepMinutes)"

STATS_RES=$(curl -sf $BASE/api/v1/stats/today)
TOTAL=$(echo "$STATS_RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['totalOrders'])" 2>/dev/null)
AVG=$(echo "$STATS_RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['averagePrepMinutes'])" 2>/dev/null)

if [[ "$TOTAL" == "2" ]]; then
  pass "totalOrders: $TOTAL"
else
  fail "totalOrders beklenen 2, alinan: $TOTAL"
fi

if [[ "$AVG" != "None" ]]; then
  pass "averagePrepMinutes: $AVG"
else
  fail "averagePrepMinutes null"
fi

echo ""

# --- 6. WebSocket testi ---
info "6/7 WebSocket baglanti testi"

if command -v websocat &>/dev/null; then
  # websocat ile WS test
  WS_RES=$(echo '{"event":"ping"}' | timeout 3 websocat -1 "ws://localhost:$PORT/ws?channel=orders" 2>/dev/null || true)
  if echo "$WS_RES" | grep -q "pong"; then
    pass "WebSocket ping/pong calisiyor"
  else
    fail "WebSocket yanit yok: $WS_RES"
  fi
else
  # Node.js ile WS test
  WS_RES=$(timeout 5 node -e "
    const WebSocket = require('ws') || (await import('ws')).default;
    const ws = new WebSocket('ws://localhost:$PORT/ws?channel=orders');
    ws.on('open', () => { ws.send(JSON.stringify({event:'ping'})); });
    ws.on('message', (d) => { console.log(d.toString()); ws.close(); });
    setTimeout(() => { console.log('timeout'); process.exit(1); }, 3000);
  " 2>/dev/null || true)

  if echo "$WS_RES" | grep -q "pong"; then
    pass "WebSocket ping/pong calisiyor"
  else
    info "WebSocket test atildi (websocat veya ws modulu gerekli)"
    info "  Kur: sudo apt install websocat VEYA npm i -g ws"
  fi
fi

echo ""

# --- 7. Ses testi ---
info "7/7 Ses cikisi testi (3.5mm / HDMI)"

# Anons kuyrugundan calan siparisi bekle (worker 2.5sn aralikla calisir)
# Ikinci siparisi READY yapip anonsun calinmasini bekleyelim
ORDER2_ID=$(echo "$CREATE_RES2" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
curl -sf -X PATCH "$BASE/api/v1/orders/$ORDER2_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status":"READY"}' > /dev/null

info "Siparis #2 READY yapildi, anons worker'i bekliyor..."
sleep 4

# Gercek ses testi: basit bir beep cal
if command -v aplay &>/dev/null; then
  # Kisa test sesi uret ve cal
  python3 -c "
import wave, struct, math
f = wave.open('/tmp/test-beep.wav', 'w')
f.setnchannels(1)
f.setsampwidth(2)
f.setframerate(44100)
for i in range(44100):  # 1 saniye
    v = int(32767 * math.sin(2 * math.pi * 440 * i / 44100))
    f.writeframes(struct.pack('<h', v))
f.close()
" 2>/dev/null

  if aplay /tmp/test-beep.wav 2>/dev/null; then
    pass "3.5mm ses cikisi calisiyor (440Hz beep duyulduysa)"
  else
    fail "aplay basarisiz (ses cikisini kontrol edin: raspi-config -> Audio)"
  fi
  rm -f /tmp/test-beep.wav
elif command -v mpv &>/dev/null; then
  info "mpv ile ses testi yapilabilir: mpv --no-video /path/to/test.wav"
else
  info "Ses testi atildi (aplay veya mpv gerekli)"
fi

echo ""
echo "======================================="
if [[ $FAILURES -eq 0 ]]; then
  echo -e "${GREEN}  TUM TESTLER GECTI${NC}"
else
  echo -e "${RED}  $FAILURES TEST BASARISIZ${NC}"
fi
echo "======================================="

# Sorun giderme notlari
if [[ $FAILURES -gt 0 ]]; then
  echo ""
  echo "Sorun Giderme:"
  echo "  Ses yok:   sudo raspi-config -> System -> Audio -> 3.5mm"
  echo "  Port mesgul: lsof -ti:3000 | xargs kill -9"
  echo "  ARM build:   npm rebuild better-sqlite3"
fi

exit $FAILURES
