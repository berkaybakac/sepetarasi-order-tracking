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

    echo "[init] .env dosyasi olusturuluyor..."
    ssh "$TARGET" "cat > $APP_DIR/.env << 'ENVEOF'
PORT=3000
DB_PATH=$APP_DIR/data/sepetarasi.db
STORE_TIMEZONE=Europe/Istanbul
ANNOUNCEMENTS_PATH=$APP_DIR/packages/server/assets/announcements
AUDIO_ALSA_DEVICE=plughw:CARD=Headphones,DEV=0
ENVEOF"

    ssh "$TARGET" "mkdir -p $APP_DIR/packages/server/assets/announcements"
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
    cp -r packages/server/src/db/migrations packages/server/dist/db/migrations

    # Migration
    DB_PATH=$APP_DIR/data/sepetarasi.db node packages/server/dist/db/migrate.js
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

# Restart
ssh "$TARGET" "sudo systemctl restart sepetarasi"

# --- 4. Smoke test ---
echo ""
echo "[4/4] Saglik kontrolu..."
sleep 2
if curl -sf "http://$HOST:3000/health" > /dev/null; then
    echo "OK"
else
    echo "BASARISIZ - kontrol: ssh $TARGET 'sudo journalctl -u sepetarasi -n 20'"
    exit 1
fi

echo ""
echo "=== Deploy tamamlandi! ==="
echo "Dashboard:       http://$HOST:3000"
echo "Musteri ekrani:  http://$HOST:3000/display"
