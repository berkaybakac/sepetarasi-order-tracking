#!/usr/bin/env bash
set -euo pipefail

# Enables persistent journald + recurring Pi4 system metrics logging.
# Usage:
#   bash scripts/pi4-enable-observability.sh
#   bash scripts/pi4-enable-observability.sh admin@192.168.1.34

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PI4_FILE="$PROJECT_DIR/.pi4"

TARGET="${1:-}"
if [[ -z "$TARGET" ]] && [[ -f "$PI4_FILE" ]]; then
	TARGET="$(tr -d '[:space:]' < "$PI4_FILE")"
fi

if [[ -z "$TARGET" ]]; then
	echo "Hata: Pi4 hedefi belirtilmedi."
	echo "Kullanim: bash scripts/pi4-enable-observability.sh admin@<PI4-IP>"
	echo "veya proje kokune .pi4 dosyasi koy: echo 'admin@<PI4-IP>' > .pi4"
	exit 1
fi

LOCAL_METRICS_SCRIPT="$PROJECT_DIR/scripts/pi4-metrics-logger.sh"
if [[ ! -f "$LOCAL_METRICS_SCRIPT" ]]; then
	echo "Hata: $LOCAL_METRICS_SCRIPT bulunamadi."
	exit 1
fi

echo "=== Sepetarasi Pi4 Observability Kurulumu ==="
echo "Hedef: $TARGET"

echo ""
echo "[1/4] Metrik logger scripti Pi4'e kopyalaniyor..."
scp "$LOCAL_METRICS_SCRIPT" "$TARGET:/tmp/sepetarasi-metrics-logger.sh"

echo ""
echo "[2/4] journald kalicilik + systemd timer + logrotate kuruluyor..."
ssh "$TARGET" "bash -s" <<'REMOTE'
set -euo pipefail

APP_USER="$(id -un)"
APP_GROUP="$(id -gn)"

sudo install -m 0755 /tmp/sepetarasi-metrics-logger.sh /usr/local/bin/sepetarasi-metrics-logger.sh
rm -f /tmp/sepetarasi-metrics-logger.sh

sudo mkdir -p /var/log/sepetarasi
sudo chown "$APP_USER:$APP_GROUP" /var/log/sepetarasi
sudo chmod 0755 /var/log/sepetarasi
sudo touch /var/log/sepetarasi/audit.log
sudo chown "$APP_USER:$APP_GROUP" /var/log/sepetarasi/audit.log
sudo chmod 0644 /var/log/sepetarasi/audit.log

sudo mkdir -p /var/log/journal
sudo chown root:systemd-journal /var/log/journal
sudo chmod 2755 /var/log/journal
sudo mkdir -p /var/log/journal/$(cat /etc/machine-id)
sudo chown root:systemd-journal /var/log/journal/$(cat /etc/machine-id)
sudo chmod 2755 /var/log/journal/$(cat /etc/machine-id)

sudo mkdir -p /etc/systemd/journald.conf.d
sudo tee /etc/systemd/journald.conf.d/99-sepetarasi-persistent.conf > /dev/null <<'EOF_JOURNAL'
[Journal]
Storage=persistent
SystemMaxUse=300M
RuntimeMaxUse=100M
EOF_JOURNAL

sudo tee /etc/systemd/system/sepetarasi-metrics.service > /dev/null <<'EOF_SERVICE'
[Unit]
Description=Sepetarasi Pi4 system metrics sampler
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/sepetarasi-metrics-logger.sh sample
EOF_SERVICE

sudo tee /etc/systemd/system/sepetarasi-metrics.timer > /dev/null <<'EOF_TIMER'
[Unit]
Description=Run Sepetarasi metrics sampler every minute

[Timer]
OnBootSec=30s
OnUnitActiveSec=1min
AccuracySec=5s
Persistent=true
Unit=sepetarasi-metrics.service

[Install]
WantedBy=timers.target
EOF_TIMER

sudo tee /etc/systemd/system/sepetarasi-boot-marker.service > /dev/null <<'EOF_BOOT'
[Unit]
Description=Sepetarasi boot marker logger
DefaultDependencies=no
After=local-fs.target systemd-journald.service
Before=shutdown.target reboot.target halt.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/sepetarasi-metrics-logger.sh boot_start
ExecStop=/usr/local/bin/sepetarasi-metrics-logger.sh boot_stop
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF_BOOT

sudo tee /etc/logrotate.d/sepetarasi-metrics > /dev/null <<'EOF_ROTATE'
/var/log/sepetarasi/system-metrics.log /var/log/sepetarasi/audit.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF_ROTATE

sudo systemctl daemon-reload
sudo systemctl restart systemd-journald
sudo systemd-tmpfiles --create --prefix /var/log/journal
sudo journalctl --flush
sudo systemctl restart systemd-journald
sudo systemctl enable --now sepetarasi-metrics.timer
sudo systemctl enable --now sepetarasi-boot-marker.service
sudo systemctl start sepetarasi-metrics.service
REMOTE

echo ""
echo "[3/4] Kurulum dogrulaniyor..."
ssh "$TARGET" "systemctl is-active sepetarasi-metrics.timer && systemctl is-enabled sepetarasi-metrics.timer"
ssh "$TARGET" "systemctl is-active sepetarasi-boot-marker.service && systemctl is-enabled sepetarasi-boot-marker.service"

echo ""
echo "[4/4] Son metrik satirlari:"
ssh "$TARGET" "tail -n 6 /var/log/sepetarasi/system-metrics.log"
ssh "$TARGET" "ls -l /var/log/sepetarasi/audit.log"

echo ""
echo "Tamamlandi."
echo "Gece analiz komutlari:"
echo "  ssh $TARGET \"journalctl --list-boots --no-pager\""
echo "  ssh $TARGET \"journalctl -k --since '2026-04-15 20:00' --until '2026-04-16 08:00' --no-pager\""
echo "  ssh $TARGET \"awk '\$0 ~ /\\\"ts\\\":\\\"2026-04-15|\\\"ts\\\":\\\"2026-04-16/ {print}' /var/log/sepetarasi/system-metrics.log\""
echo "  ssh $TARGET \"tail -n 20 /var/log/sepetarasi/audit.log\""
