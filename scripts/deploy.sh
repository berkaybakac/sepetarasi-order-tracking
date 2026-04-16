#!/usr/bin/env bash
set -euo pipefail

# Sepetarasi Deploy Script
# Mac uzerinde calistirilir. Kodu Pi4'e gonderir ve servisi baslatir.
#
# Kullanim:
#   bash scripts/deploy.sh                             # .pi4 dosyasindan hedef okur
#   bash scripts/deploy.sh admin@192.168.1.34          # veya direkt IP/hostname
#   bash scripts/deploy.sh admin@sepetarasi.local      # hostname ile
#   bash scripts/deploy.sh admin@192.168.1.34 --init   # ilk kurulum

PI4_FILE="$(dirname "$0")/../.pi4"
DEFAULT_TARGET=""
if [ -f "$PI4_FILE" ]; then
  DEFAULT_TARGET="$(cat "$PI4_FILE" | tr -d '[:space:]')"
fi

TARGET=""
INIT=""
for arg in "$@"; do
  if [ "$arg" = "--init" ]; then
    INIT="--init"
  else
    TARGET="$arg"
  fi
done
TARGET="${TARGET:-$DEFAULT_TARGET}"
if [ -z "$TARGET" ]; then
  echo "Hata: Hedef belirtilmedi. Kullanim: bash scripts/deploy.sh kullanici@ip [--init]"
  echo "      Veya proje kokune .pi4 dosyasi olustur: echo 'admin@192.168.1.34' > .pi4"
  exit 1
fi
APP_DIR="/opt/sepetarasi"
MUSIC_DIR="$APP_DIR/packages/server/assets/music"
ANNOUNCEMENTS_DIR="$APP_DIR/packages/server/assets/announcements"
AUDIT_LOG_DIR="/var/log/sepetarasi"
AUDIT_LOG_PATH="$AUDIT_LOG_DIR/audit.log"
HOST="${TARGET#*@}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Sepetarasi Deploy ==="
echo "Hedef: $TARGET:$APP_DIR"

# --- Ilk kurulum (sadece --init ile) ---
if [ "$INIT" = "--init" ]; then
    echo ""
    echo "[init] Node.js 20 yukleniyor..."
    ssh "$TARGET" "
        if ! command -v node &>/dev/null; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
        fi
        echo \"Node.js: \$(node -v)\"
    "

    echo "[init] Sistem bagimliliklari..."
    ssh "$TARGET" "sudo apt-get install -y --no-install-recommends build-essential python3 alsa-utils mpg123 avahi-daemon sqlite3 2>&1 | tail -1"

    echo "[init] Hostname 'sepetarasi' olarak ayarlaniyor (sepetarasi.local erisilebilir olacak)..."
    ssh "$TARGET" "
        sudo hostnamectl set-hostname sepetarasi
        sudo sed -i 's/127\.0\.1\.1.*/127.0.1.1\tsepetarasi/' /etc/hosts
        sudo systemctl enable avahi-daemon
        sudo systemctl start avahi-daemon
    "

    echo "[init] Ses cikisi 3.5mm jack olarak ayarlaniyor..."
    ssh "$TARGET" "
        sudo raspi-config nonint do_audio 1
        sudo usermod -a -G audio \$(id -un)
    "

    echo "[init] Uygulama dizini olusturuluyor..."
    ssh "$TARGET" "sudo mkdir -p $APP_DIR && sudo chown \$USER:\$USER $APP_DIR"

    echo "[init] Audit log dizini hazirlaniyor..."
    ssh "$TARGET" "
        sudo mkdir -p $AUDIT_LOG_DIR
        sudo chown \$(id -un):\$(id -gn) $AUDIT_LOG_DIR
        sudo chmod 0755 $AUDIT_LOG_DIR
        touch $AUDIT_LOG_PATH
        chmod 0644 $AUDIT_LOG_PATH
    "

    echo "[init] .env dosyasi olusturuluyor..."
    CASHIER_TOKEN="$(openssl rand -hex 16)"
    JWT_SECRET="$(openssl rand -hex 32)"
    COOKIE_SECRET="$(openssl rand -hex 32)"
    ssh "$TARGET" "cat > $APP_DIR/.env << ENVEOF
NODE_ENV=production
PORT=3000
DB_PATH=$APP_DIR/data/sepetarasi.db
STORE_TIMEZONE=Europe/Istanbul
ANNOUNCEMENTS_PATH=$ANNOUNCEMENTS_DIR
MUSIC_PATH=$MUSIC_DIR
AUDIO_ALSA_DEVICE=plughw:CARD=Headphones,DEV=0
CASHIER_TOKEN=$CASHIER_TOKEN
JWT_SECRET=$JWT_SECRET
COOKIE_SECRET=$COOKIE_SECRET
WS_AUTH_KEY=dev-ws-auth-key
LOG_PATH=$AUDIT_LOG_PATH
ENVEOF"

    ssh "$TARGET" "mkdir -p $ANNOUNCEMENTS_DIR $MUSIC_DIR"
fi

# --- 1. Mac'te build ---
echo ""
echo "[1/4] Mac'te build ediliyor..."
cd "$PROJECT_DIR"
npm run build

# --- 2. Rsync ---
echo ""
echo "[2/4] Dosyalar gonderiliyor..."
rsync -az --delete \
    --exclude node_modules \
    --exclude .git \
    --exclude 'packages/kasa' \
    --exclude 'packages/server/assets/music/***' \
    --exclude 'data/*.log' \
    --exclude '*.db' \
    --exclude '*.db-wal' \
    --exclude '*.db-shm' \
    --exclude .env \
    --exclude dist-electron \
    --exclude release \
    "$PROJECT_DIR/" "$TARGET:$APP_DIR/"

# --- 3. Pi4'de kurulum ---
echo ""
echo "[3/4] Pi4'de kurulum..."
ssh "$TARGET" "
    cd $APP_DIR

    # Kasa stub (workspace hata vermemesi icin)
    mkdir -p packages/kasa
    echo '{\"name\":\"@sepetarasi/kasa\",\"version\":\"0.1.0\",\"private\":true}' > packages/kasa/package.json

    # Bagimliliklar
    npm install --omit=dev 2>&1 | tail -3

    # Migration SQL dosyalarini dist'e kopyala (tsc bunlari kopyalamaz)
    mkdir -p packages/server/dist/db/migrations
    cp -r packages/server/src/db/migrations/. packages/server/dist/db/migrations/

    # Migration
    DB_PATH=$APP_DIR/data/sepetarasi.db node packages/server/dist/db/migrate.js
"

ssh "$TARGET" "
    sudo mkdir -p $AUDIT_LOG_DIR
    sudo chown \$(id -un):\$(id -gn) $AUDIT_LOG_DIR
    sudo chmod 0755 $AUDIT_LOG_DIR
    touch $AUDIT_LOG_PATH
    chmod 0644 $AUDIT_LOG_PATH

    if [ -f $APP_DIR/.env ] && ! grep -q '^LOG_PATH=' $APP_DIR/.env; then
        printf '\nLOG_PATH=$AUDIT_LOG_PATH\n' >> $APP_DIR/.env
    fi
    if [ -f $APP_DIR/.env ] && ! grep -q '^MUSIC_PATH=' $APP_DIR/.env; then
        printf '\nMUSIC_PATH=$MUSIC_DIR\n' >> $APP_DIR/.env
    fi
    mkdir -p $ANNOUNCEMENTS_DIR $MUSIC_DIR
"

# Seed sadece ilk kurulumda
if [ "$INIT" = "--init" ]; then
    echo "[init] Seed verisi yukleniyor..."
    ssh "$TARGET" "cd $APP_DIR && DB_PATH=$APP_DIR/data/sepetarasi.db node packages/server/dist/db/seed.js"

    echo "[init] systemd servisi kuruluyor..."
    ssh "$TARGET" "
        sudo tee /etc/systemd/system/sepetarasi.service > /dev/null << SVCEOF
[Unit]
Description=Sepetarasi Order Tracking Server
After=network.target

[Service]
Type=simple
User=\$(id -un)
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=/usr/bin/node packages/server/dist/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF
        sudo systemctl daemon-reload
        sudo systemctl enable sepetarasi
    "
fi

# Ensure .env is always honored (new + old installs) via systemd drop-in.
ssh "$TARGET" "
    sudo mkdir -p /etc/systemd/system/sepetarasi.service.d
    sudo tee /etc/systemd/system/sepetarasi.service.d/10-envfile.conf > /dev/null << 'SVCDROP'
[Service]
EnvironmentFile=-$APP_DIR/.env
SVCDROP
    sudo systemctl daemon-reload
"

# Restart (single restart after unit/drop-in is in final state)
ssh "$TARGET" "sudo systemctl restart sepetarasi"

# Verify runtime env wiring for audio device (fail-fast on misconfigured units).
ssh "$TARGET" "
    if [ ! -f $APP_DIR/.env ]; then
        echo \"[audio-check] FAIL: $APP_DIR/.env bulunamadi\"
        echo \"[audio-check] ornek: AUDIO_ALSA_DEVICE=plughw:CARD=Headphones,DEV=0\"
        exit 1
    fi

    EXPECTED_AUDIO_DEVICE=\$(grep '^AUDIO_ALSA_DEVICE=' $APP_DIR/.env | tail -n 1 | cut -d= -f2- | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')
    if [ -z \"\$EXPECTED_AUDIO_DEVICE\" ]; then
        echo \"[audio-check] FAIL: .env icinde AUDIO_ALSA_DEVICE zorunlu\"
        echo \"[audio-check] ornek: AUDIO_ALSA_DEVICE=plughw:CARD=Headphones,DEV=0\"
        exit 1
    fi

    MAIN_PID=\$(sudo systemctl show -p MainPID --value sepetarasi)
    if [ -z \"\$MAIN_PID\" ] || [ \"\$MAIN_PID\" = \"0\" ]; then
        echo \"[audio-check] FAIL: sepetarasi MainPID bulunamadi\"
        exit 1
    fi

    if ! sudo tr '\0' '\n' < /proc/\$MAIN_PID/environ | grep -q \"^AUDIO_ALSA_DEVICE=\$EXPECTED_AUDIO_DEVICE\$\"; then
        echo \"[audio-check] FAIL: process env icinde AUDIO_ALSA_DEVICE beklenen degerde degil\"
        echo \"[audio-check] expected=\$EXPECTED_AUDIO_DEVICE\"
        echo \"[audio-check] kontrol: sudo systemctl cat sepetarasi\"
        exit 1
    fi

    if ! command -v aplay > /dev/null 2>&1; then
        echo \"[audio-check] FAIL: aplay bulunamadi (alsa-utils eksik)\"
        exit 1
    fi

    ALSA_PLAYBACK_NAMES=\$(aplay -L 2>/dev/null || true)
    ALSA_HARDWARE_LIST=\$(aplay -l 2>/dev/null || true)
    ALSA_DEVICE_FOUND=0

    if echo \"\$ALSA_PLAYBACK_NAMES\" | grep -Fqx \"\$EXPECTED_AUDIO_DEVICE\"; then
        ALSA_DEVICE_FOUND=1
    elif echo \"\$ALSA_PLAYBACK_NAMES\" | grep -Fq \"\$EXPECTED_AUDIO_DEVICE\"; then
        ALSA_DEVICE_FOUND=1
    elif echo \"\$EXPECTED_AUDIO_DEVICE\" | grep -Eq '^(plug)?hw:[0-9]+,[0-9]+$'; then
        CARD_NUM=\$(echo \"\$EXPECTED_AUDIO_DEVICE\" | sed -E 's/^(plug)?hw:([0-9]+),([0-9]+)$/\2/')
        DEV_NUM=\$(echo \"\$EXPECTED_AUDIO_DEVICE\" | sed -E 's/^(plug)?hw:([0-9]+),([0-9]+)$/\3/')
        if echo \"\$ALSA_HARDWARE_LIST\" | grep -Eq \"card[[:space:]]+\$CARD_NUM:\" && \
           echo \"\$ALSA_HARDWARE_LIST\" | grep -Eq \"device[[:space:]]+\$DEV_NUM:\"; then
            ALSA_DEVICE_FOUND=1
        fi
    fi

    if [ \"\$ALSA_DEVICE_FOUND\" != \"1\" ]; then
        echo \"[audio-check] FAIL: AUDIO_ALSA_DEVICE sistemde bulunamadi\"
        echo \"[audio-check] expected=\$EXPECTED_AUDIO_DEVICE\"
        echo \"[audio-check] aplay -L (ilk 40 satir):\"
        echo \"\$ALSA_PLAYBACK_NAMES\" | head -n 40
        echo \"[audio-check] aplay -l (ilk 40 satir):\"
        echo \"\$ALSA_HARDWARE_LIST\" | head -n 40
        exit 1
    fi

    echo \"[audio-check] OK: AUDIO_ALSA_DEVICE=\$EXPECTED_AUDIO_DEVICE\"
"

# --- 4. Smoke test ---
echo ""
echo "[4/4] Saglik kontrolu..."
HEALTH_OK=0
for ATTEMPT in $(seq 1 10); do
    if curl -sf "http://$HOST:3000/health" > /dev/null; then
        HEALTH_OK=1
        echo "OK (deneme $ATTEMPT/10)"
        break
    fi
    if [ "$ATTEMPT" -lt 10 ]; then
        echo "Health bekleniyor... deneme $ATTEMPT/10 basarisiz, 3sn sonra tekrar"
        sleep 3
    fi
done

if [ "$HEALTH_OK" != "1" ]; then
    echo "BASARISIZ - kontrol: ssh $TARGET 'sudo journalctl -u sepetarasi -n 20'"
    exit 1
fi

if [ "$INIT" = "--init" ]; then
    echo ""
    echo "[init] Pi4 observability kuruluyor..."
    bash "$SCRIPT_DIR/pi4-enable-observability.sh" "$TARGET"
elif ! ssh "$TARGET" "systemctl is-enabled sepetarasi-metrics.timer >/dev/null 2>&1"; then
    echo ""
    echo "[uyari] Pi4 observability kurulu gorunmuyor."
    echo "[uyari] Calistir: bash scripts/pi4-enable-observability.sh $TARGET"
fi

echo ""
echo "=== Deploy tamamlandi! ==="
echo "Yonetici paneli: http://$HOST:3000"
echo "Musteri ekrani:  http://$HOST:3000/display"
echo "Admin:           http://$HOST:3000/admin"

if [ "$INIT" = "--init" ]; then
    echo ""
    echo "=========================================="
    echo "  CASHIER_TOKEN: $CASHIER_TOKEN"
    echo "=========================================="
    echo "Bu token'i tum kasa uygulamalarinda (macOS/Windows) kullan."
    echo "Unutursan: ssh $TARGET 'grep CASHIER $APP_DIR/.env'"
fi
