#!/usr/bin/env bash
# =============================================================
# Pi4 Smoke Test
# Hedef: Raspberry Pi 4 (ARM64) uzerinde API + WS + anons + ses
# Onkosul: Node.js 20+, npm, aplay veya mpv kurulu
# Calistir: bash scripts/pi4-smoke-test.sh
# Not: Varsayilan olarak izole port + gecici DB kullanir (canli systemd servisiyle cakismasin diye)
# =============================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; FAILURES=$((FAILURES + 1)); }
info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

run_aplay_with_retry() {
  local attempt=1
  local max_attempts=5
  local output=""
  local rc=0

  while ((attempt <= max_attempts)); do
    if output="$("$@" 2>&1)"; then
      return 0
    fi

    rc=$?
    if echo "$output" | grep -qi "device or resource busy"; then
      info "ALSA cihazi mesgul, tekrar deneniyor ($attempt/$max_attempts)"
      sleep 1
      attempt=$((attempt + 1))
      continue
    fi
    break
  done

  if [[ -n "$output" ]]; then
    echo "$output" | head -n 3
  fi
  return $rc
}

FAILURES=0
PORT="${PORT:-3100}"
BASE="http://localhost:$PORT"
TEST_DB_PATH="${TEST_DB_PATH:-/tmp/sepetarasi-smoke-test.db}"
SERVER_LOG="${SERVER_LOG:-/tmp/sepetarasi-smoke-test-server.log}"
SERVER_PID=""

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}

wait_for_health() {
  local deadline=$((SECONDS + 60))
  while ((SECONDS < deadline)); do
    if curl -sf "$BASE/health" >/dev/null 2>&1; then
      return 0
    fi
    if [[ -n "${SERVER_PID:-}" ]] && ! kill -0 "$SERVER_PID" 2>/dev/null; then
      return 1
    fi
    sleep 1
  done
  return 1
}

trap cleanup EXIT INT TERM

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

# Mevcut deploy servisini sadece bilgilendirme amacli kontrol et (testi etkilemez)
if command -v systemctl &>/dev/null; then
  if sudo -n systemctl is-active --quiet sepetarasi 2>/dev/null; then
    pass "systemd sepetarasi servisi aktif"
  else
    info "systemd sepetarasi servisi aktif degil veya sudo -n yetkisi yok"
  fi
fi

# Ses cikisi kontrol (sadece Linux'ta zorunlu)
if command -v aplay &>/dev/null; then
  pass "aplay mevcut"
elif command -v mpv &>/dev/null; then
  pass "mpv mevcut"
elif [[ "$(uname)" != "Linux" ]]; then
  info "Ses araci yok — macOS'ta beklenen durum, Pi4'te calistir"
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
info "Izole test ortami: port=$PORT, db=$TEST_DB_PATH"

if lsof -ti:"$PORT" >/dev/null 2>&1; then
  fail "Port $PORT mesgul. Farkli port icin: PORT=3101 bash scripts/pi4-smoke-test.sh"
  exit 1
fi

rm -f "$TEST_DB_PATH" "$TEST_DB_PATH-wal" "$TEST_DB_PATH-shm" "$SERVER_LOG"

START_CMD="npx tsx packages/server/src/server.ts"
if [[ -f packages/server/dist/server.js ]]; then
  START_CMD="node packages/server/dist/server.js"
  PORT="$PORT" DB_PATH="$TEST_DB_PATH" node packages/server/dist/server.js >"$SERVER_LOG" 2>&1 &
else
  PORT="$PORT" DB_PATH="$TEST_DB_PATH" npx tsx packages/server/src/server.ts >"$SERVER_LOG" 2>&1 &
fi
SERVER_PID=$!

if wait_for_health; then
  pass "Sunucu hazir (PID: $SERVER_PID, port: $PORT)"
else
  fail "Sunucu health hazir olmadi (komut: $START_CMD)"
  echo "---- server log (son 40 satir) ----"
  tail -n 40 "$SERVER_LOG" || true
  exit 1
fi

echo ""

# --- 3. API testi ---
info "3/7 API testleri"

if HEALTH=$(curl -sf "$BASE/health"); then
  if echo "$HEALTH" | grep -q '"ok":true'; then
    pass "GET /health"
  else
    fail "GET /health: $HEALTH"
  fi
else
  fail "GET /health: erisim yok"
  echo "---- server log (son 40 satir) ----"
  tail -n 40 "$SERVER_LOG" || true
  exit 1
fi

# Siparis olustur
if ! CREATE_RES=$(curl -sf -X POST "$BASE/api/v1/orders" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"name":"Doner","quantity":2,"unit_price":15000},{"name":"Ayran","quantity":2,"unit_price":3000}]}'); then
  fail "POST /orders basarisiz"
  exit 1
fi

ORDER_ID=$(echo "$CREATE_RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
DISPLAY_NO=$(echo "$CREATE_RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['display_no'])" 2>/dev/null)

if [[ -n "$ORDER_ID" ]]; then
  pass "POST /orders -> #$DISPLAY_NO ($ORDER_ID)"
else
  fail "POST /orders: $CREATE_RES"
fi

# Ikinci siparis
if ! CREATE_RES2=$(curl -sf -X POST "$BASE/api/v1/orders" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"name":"Lahmacun","quantity":1,"unit_price":12000}]}'); then
  fail "2. POST /orders basarisiz"
  exit 1
fi
DISPLAY_NO2=$(echo "$CREATE_RES2" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['display_no'])" 2>/dev/null)

if [[ "$DISPLAY_NO2" == "2" ]]; then
  pass "display_no auto-increment: #$DISPLAY_NO2"
else
  fail "display_no beklenen 2, alinan: $DISPLAY_NO2"
fi

echo ""

# --- 4. Durum gecisi + READY atomic ---
info "4/7 Durum gecisi + atomic READY"

if ! READY_RES=$(curl -sf -X PATCH "$BASE/api/v1/orders/$ORDER_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status":"READY"}'); then
  fail "READY gecisi basarisiz"
  exit 1
fi

READY_STATUS=$(echo "$READY_RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])" 2>/dev/null)
READY_AT=$(echo "$READY_RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['ready_at'])" 2>/dev/null)

if [[ "$READY_STATUS" == "READY" && "$READY_AT" != "None" ]]; then
  pass "PREPARING -> READY (ready_at: $READY_AT)"
else
  fail "Status change: status=$READY_STATUS, ready_at=$READY_AT"
fi

# READY->PREPARING gecerli oldugu icin DELIVERED->PREPARING ile invalid gecisi test et
curl -sf -X PATCH "$BASE/api/v1/orders/$ORDER_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status":"DELIVERED"}' >/dev/null
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

if ! STATS_RES=$(curl -sf "$BASE/api/v1/stats/today"); then
  fail "GET /stats/today basarisiz"
  exit 1
fi
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
    let WebSocket;
    try { WebSocket = require('ws'); } catch { process.exit(2); }
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

# READY sonrasi olasi ALSA cakismasini azaltmak icin:
# - Once player surecinin baslayip baslamayacagini kisa bir pencere boyunca gozle
# - Baslamissa bitene kadar (max 20s) bekle
AUDIO_WAIT_START=$SECONDS
AUDIO_WAIT_DEADLINE=$((SECONDS + 20))
PLAYER_SEEN=0
while ((SECONDS < AUDIO_WAIT_DEADLINE)); do
  if pgrep -x mpg123 >/dev/null 2>&1 || pgrep -x espeak-ng >/dev/null 2>&1; then
    PLAYER_SEEN=1
  else
    if [[ "$PLAYER_SEEN" -eq 1 ]]; then
      info "Anons player'i bitti, beep testine geciliyor"
      break
    fi
    if ((SECONDS - AUDIO_WAIT_START >= 5)); then
      info "Anons player sureci gozlenmedi, beep testine geciliyor"
      break
    fi
  fi
  sleep 1
done

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

  PLAYED=0
  if run_aplay_with_retry aplay /tmp/test-beep.wav; then
    pass "Ses cikisi calisiyor (default ALSA cihaz)"
    PLAYED=1
  else
    for dev in "plughw:CARD=Headphones,DEV=0" "plughw:CARD=vc4hdmi0,DEV=0"; do
      if run_aplay_with_retry aplay -D "$dev" /tmp/test-beep.wav; then
        pass "Ses cikisi calisiyor (ALSA cihaz: $dev)"
        PLAYED=1
        break
      fi
    done
  fi

  if [[ "$PLAYED" -eq 0 ]]; then
    fail "aplay basarisiz (default + fallback cihazlar). raspi-config ile output secimini kontrol edin"
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
  echo "  Port mesgul: lsof -ti:$PORT | xargs kill -9"
  echo "  Log:       tail -n 80 $SERVER_LOG"
  echo "  ARM build: npm rebuild better-sqlite3"
fi

exit $FAILURES
