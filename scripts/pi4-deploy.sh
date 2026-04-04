#!/usr/bin/env bash
set -euo pipefail

# Sepetarasi Pi4 Deploy Script
# Raspberry Pi 4 (ARM64) uzerinde sifirdan kurulum yapar.
# Kullanim: bash pi4-deploy.sh [repo-dizini]

APP_DIR="${1:-/opt/sepetarasi}"
SERVICE_NAME="sepetarasi"
NODE_VERSION="20"

is_project_dir() {
    local dir="$1"
    [ -f "$dir/package.json" ] && [ -d "$dir/packages/server" ] && [ -d "$dir/packages/web" ]
}

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
sudo apt-get install -y --no-install-recommends build-essential python3 alsa-utils espeak-ng mpg123 rsync

# --- 3. Uygulama dizini ---
echo "[3/7] Uygulama dizini hazirlaniyor..."
if [ ! -d "$APP_DIR" ]; then
    sudo mkdir -p "$APP_DIR"
    sudo chown "$USER:$USER" "$APP_DIR"
fi

# Eger APP_DIR git repo ise pull yap.
# Degilse:
# - APP_DIR zaten proje ise mevcut dosyalarla devam et.
# - Script repo/proje klasorunden calisiyorsa APP_DIR'e rsync et.
if [ -d "$APP_DIR/.git" ]; then
    echo "  Git pull..."
    cd "$APP_DIR" && git pull
elif is_project_dir "$APP_DIR"; then
    echo "  APP_DIR git repo degil ama proje mevcut, mevcut dosyalarla devam ediliyor."
elif is_project_dir "$(pwd)"; then
    echo "  Proje dosyalari APP_DIR'e kopyalaniyor (rsync)..."
    rsync -a --delete \
        --exclude .git \
        --exclude node_modules \
        --exclude dist \
        --exclude release \
        --exclude '*.db' \
        ./ "$APP_DIR/"
else
    echo "  HATA: Ne $APP_DIR'de gecerli bir proje bulundu ne de script proje klasorunden calistirildi."
    echo "  Cozum 1: Scripti proje klasorunde calistir."
    echo "  Cozum 2: Once dosyalari $APP_DIR altina kopyala, sonra scripti tekrar calistir."
    exit 1
fi

cd "$APP_DIR"

# --- 4. Bagimliliklari yukle ---
echo "[4/7] Bagimliliklar yukleniyor..."
if [ -f package-lock.json ]; then
    npm ci
else
    npm install
fi

# --- 5. Build ---
echo "[5/7] Build (shared + web + server)..."
npm run build

# Migration SQL dosyalarini dist'e kopyala (tsc bunlari kopyalamaz)
# server.ts startup'ta resolve(__dirname, "db/migrations") ile okuyor
mkdir -p packages/server/dist/db/migrations
cp -r packages/server/src/db/migrations/. packages/server/dist/db/migrations/

# --- 6. Migration (+ ilk kurulumda seed) ---
echo "[6/7] Veritabani migration..."
[ ! -f "$APP_DIR/data/sepetarasi.db" ] && SHOULD_SEED=true || SHOULD_SEED=false
npm run db:migrate
if [ "$SHOULD_SEED" = true ]; then
    echo "  Ilk kurulum: seed calistiriliyor..."
    npm run db:seed
fi

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
