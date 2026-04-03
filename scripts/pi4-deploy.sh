#!/usr/bin/env bash
set -euo pipefail

# Sepetarasi Pi4 Deploy Script
# Raspberry Pi 4 (ARM64) uzerinde sifirdan kurulum yapar.
# Kullanim: bash pi4-deploy.sh [repo-dizini]

APP_DIR="${1:-/opt/sepetarasi}"
SERVICE_NAME="sepetarasi"
NODE_VERSION="20"

echo "=== Sepetarasi Pi4 Deploy ==="
echo "Hedef dizin: $APP_DIR"

# --- 1. Node.js 20 LTS (ARM64) ---
if ! command -v node &>/dev/null || ! node -v | grep -q "v${NODE_VERSION}"; then
    echo "[1/7] Node.js $NODE_VERSION yuklenyor..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "[1/7] Node.js $(node -v) zaten yuklu."
fi

# --- 2. Sistem bagimliliklari ---
echo "[2/7] Sistem bagimliliklari kontrol ediliyor..."
sudo apt-get install -y --no-install-recommends build-essential python3 alsa-utils

# --- 3. Uygulama dizini ---
echo "[3/7] Uygulama dizini hazirlaniyor..."
if [ ! -d "$APP_DIR" ]; then
    sudo mkdir -p "$APP_DIR"
    sudo chown "$USER:$USER" "$APP_DIR"
fi

# Eger git repo varsa pull, yoksa kopyala
if [ -d "$APP_DIR/.git" ]; then
    echo "  Git pull..."
    cd "$APP_DIR" && git pull
elif [ -d ".git" ]; then
    echo "  Repo kopyalaniyor..."
    rsync -a --exclude node_modules --exclude dist --exclude '*.db' . "$APP_DIR/"
else
    echo "  HATA: Bu scripti repo dizininde calistirin veya $APP_DIR'de git repo olsun."
    exit 1
fi

cd "$APP_DIR"

# --- 4. Bagimliliklari yukle ---
echo "[4/7] npm install..."
npm install --omit=dev

# --- 5. Build ---
echo "[5/7] Build (shared + web + server)..."
npm run build -w @sepetarasi/shared
npm run build -w packages/web
npm run build -w packages/server

# --- 6. Migration + Seed ---
echo "[6/7] Veritabani migration + seed..."
npm run db:migrate
npm run db:seed

# --- 7. systemd servisi ---
echo "[7/7] systemd servisi kuruluyor..."

sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null <<EOF
[Unit]
Description=Sepetarasi Order Tracking Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
ExecStart=$(which node) packages/server/dist/server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DB_PATH=$APP_DIR/data/sepetarasi.db

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"

# --- Ses cikisi ayarla ---
# Pi4'te 3.5mm jack'ten ses cikmasi icin:
# sudo raspi-config nonint do_audio 1
# (1 = 3.5mm jack, 2 = HDMI)
echo ""
echo "Ses cikisi icin: sudo raspi-config nonint do_audio 1"

# --- Smoke test ---
echo ""
echo "Servis durumu:"
sudo systemctl status "$SERVICE_NAME" --no-pager || true

sleep 2
echo ""
echo "Saglik kontrolu:"
curl -sf http://localhost:3000/health && echo " OK" || echo " BASARISIZ"

echo ""
echo "=== Deploy tamamlandi! ==="
echo "Erisim: http://$(hostname -I | awk '{print $1}'):3000"
