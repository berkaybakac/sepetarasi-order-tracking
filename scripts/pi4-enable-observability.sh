#!/usr/bin/env bash
set -euo pipefail

# Enables persistent journald, recurring Pi4 metrics logging, boot-delayed
# audio normalization, and one-command health reporting.
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
LOCAL_HEALTH_SCRIPT="$PROJECT_DIR/scripts/pi4-health-report.sh"
LOCAL_AUDIO_NORMALIZE_SCRIPT="$PROJECT_DIR/scripts/pi4-audio-normalize.sh"
LOCAL_ENSURE_AUDIO_SCRIPT="$PROJECT_DIR/scripts/pi4-ensure-audio.sh"
for required_script in "$LOCAL_METRICS_SCRIPT" "$LOCAL_HEALTH_SCRIPT" "$LOCAL_AUDIO_NORMALIZE_SCRIPT" "$LOCAL_ENSURE_AUDIO_SCRIPT"; do
	if [[ ! -f "$required_script" ]]; then
		echo "Hata: $required_script bulunamadi."
		exit 1
	fi
done

echo "=== Sepetarasi Pi4 Observability Kurulumu ==="
echo "Hedef: $TARGET"

REMOTE_INSTALLER="$(mktemp "${TMPDIR:-/tmp}/sepetarasi-observability-install.XXXXXX")"
trap 'rm -f "$REMOTE_INSTALLER"' EXIT

cat > "$REMOTE_INSTALLER" <<'REMOTE_INSTALLER_EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" != "0" ]]; then
	echo "Hata: installer root olarak calismali. Ornek: sudo bash /tmp/sepetarasi-observability-install.sh"
	exit 1
fi

APP_USER="${APP_USER:-${SUDO_USER:-admin}}"
if ! id "$APP_USER" >/dev/null 2>&1; then
	APP_USER="$(logname 2>/dev/null || echo admin)"
fi
APP_GROUP="${APP_GROUP:-$(id -gn "$APP_USER" 2>/dev/null || echo "$APP_USER")}"

install -m 0755 /tmp/sepetarasi-metrics-logger.sh /usr/local/bin/sepetarasi-metrics-logger.sh
install -m 0755 /tmp/sepetarasi-health /usr/local/bin/sepetarasi-health
install -m 0755 /tmp/sepetarasi-audio-normalize.sh /usr/local/bin/sepetarasi-audio-normalize.sh
if [[ -d /opt/sepetarasi/scripts ]]; then
	install -m 0755 /tmp/sepetarasi-pi4-ensure-audio.sh /opt/sepetarasi/scripts/pi4-ensure-audio.sh
fi
rm -f /tmp/sepetarasi-metrics-logger.sh /tmp/sepetarasi-health /tmp/sepetarasi-audio-normalize.sh /tmp/sepetarasi-pi4-ensure-audio.sh

mkdir -p /var/log/sepetarasi
chown "$APP_USER:$APP_GROUP" /var/log/sepetarasi
chmod 0755 /var/log/sepetarasi
touch /var/log/sepetarasi/audit.log
touch /var/log/sepetarasi/system-metrics.log
touch /var/log/sepetarasi/audio-normalize.log
chown "$APP_USER:$APP_GROUP" /var/log/sepetarasi/audit.log /var/log/sepetarasi/system-metrics.log /var/log/sepetarasi/audio-normalize.log
chmod 0644 /var/log/sepetarasi/audit.log /var/log/sepetarasi/system-metrics.log /var/log/sepetarasi/audio-normalize.log

mkdir -p /var/log/journal
chown root:systemd-journal /var/log/journal
chmod 2755 /var/log/journal
mkdir -p /var/log/journal/$(cat /etc/machine-id)
chown root:systemd-journal /var/log/journal/$(cat /etc/machine-id)
chmod 2755 /var/log/journal/$(cat /etc/machine-id)

mkdir -p /etc/systemd/journald.conf.d
tee /etc/systemd/journald.conf.d/99-sepetarasi-persistent.conf > /dev/null <<'EOF_JOURNAL'
[Journal]
Storage=persistent
SystemMaxUse=300M
RuntimeMaxUse=100M
EOF_JOURNAL

tee /etc/systemd/system/sepetarasi-metrics.service > /dev/null <<EOF_SERVICE
[Unit]
Description=Sepetarasi Pi4 system metrics sampler
After=network-online.target

[Service]
Type=oneshot
Environment=SEPETARASI_PIPEWIRE_USER=$APP_USER
ExecStart=/usr/local/bin/sepetarasi-metrics-logger.sh sample
EOF_SERVICE

tee /etc/systemd/system/sepetarasi-metrics.timer > /dev/null <<'EOF_TIMER'
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

tee /etc/systemd/system/sepetarasi-boot-marker.service > /dev/null <<EOF_BOOT
[Unit]
Description=Sepetarasi boot marker logger
DefaultDependencies=no
After=local-fs.target systemd-journald.service
Before=shutdown.target reboot.target halt.target

[Service]
Type=oneshot
Environment=SEPETARASI_PIPEWIRE_USER=$APP_USER
ExecStart=/usr/local/bin/sepetarasi-metrics-logger.sh boot_start
ExecStop=/usr/local/bin/sepetarasi-metrics-logger.sh boot_stop
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF_BOOT

tee /etc/systemd/system/sepetarasi-audio-normalize.service > /dev/null <<EOF_AUDIO_SERVICE
[Unit]
Description=Sepetarasi delayed audio normalization
After=multi-user.target sound.target pipewire.service wireplumber.service
Wants=sound.target

[Service]
Type=oneshot
EnvironmentFile=-/opt/sepetarasi/.env
Environment=SEPETARASI_AUDIO_BASELINE_PCT=90
Environment=SEPETARASI_PIPEWIRE_USER=$APP_USER
ExecStart=/usr/local/bin/sepetarasi-audio-normalize.sh
EOF_AUDIO_SERVICE

tee /etc/systemd/system/sepetarasi-audio-normalize.timer > /dev/null <<'EOF_AUDIO_TIMER'
[Unit]
Description=Run Sepetarasi audio normalization after boot

[Timer]
OnBootSec=60s
AccuracySec=5s
Unit=sepetarasi-audio-normalize.service

[Install]
WantedBy=timers.target
EOF_AUDIO_TIMER

mkdir -p /etc/systemd/system/sepetarasi.service.d
tee /etc/systemd/system/sepetarasi.service.d/20-audio-init.conf > /dev/null <<'EOF_SEPETARASI_AUDIO_DROPIN'
[Unit]
After=alsa-restore.service sound.target
Wants=sound.target

[Service]
Environment=SEPETARASI_AUDIO_BASELINE_PCT=90
ExecStartPre=/bin/bash /opt/sepetarasi/scripts/pi4-ensure-audio.sh
EOF_SEPETARASI_AUDIO_DROPIN

tee /etc/logrotate.d/sepetarasi-metrics > /dev/null <<'EOF_ROTATE'
/var/log/sepetarasi/system-metrics.log /var/log/sepetarasi/audit.log /var/log/sepetarasi/audio-normalize.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF_ROTATE

systemctl daemon-reload
systemctl restart systemd-journald
systemd-tmpfiles --create --prefix /var/log/journal
journalctl --flush
systemctl restart systemd-journald
systemctl enable --now sepetarasi-metrics.timer
systemctl enable --now sepetarasi-boot-marker.service
systemctl enable --now sepetarasi-audio-normalize.timer
systemctl start sepetarasi-metrics.service
systemctl start sepetarasi-audio-normalize.service
rm -f /tmp/sepetarasi-observability-install.sh
REMOTE_INSTALLER_EOF

echo ""
echo "[1/4] Health, metrik ve audio scriptleri Pi4'e kopyalaniyor..."
scp "$LOCAL_METRICS_SCRIPT" "$TARGET:/tmp/sepetarasi-metrics-logger.sh"
scp "$LOCAL_HEALTH_SCRIPT" "$TARGET:/tmp/sepetarasi-health"
scp "$LOCAL_AUDIO_NORMALIZE_SCRIPT" "$TARGET:/tmp/sepetarasi-audio-normalize.sh"
scp "$LOCAL_ENSURE_AUDIO_SCRIPT" "$TARGET:/tmp/sepetarasi-pi4-ensure-audio.sh"
scp "$REMOTE_INSTALLER" "$TARGET:/tmp/sepetarasi-observability-install.sh"

echo ""
echo "[2/4] journald kalicilik + systemd timer + logrotate kuruluyor..."
ssh -tt "$TARGET" "sudo bash /tmp/sepetarasi-observability-install.sh"

echo ""
echo "[3/4] Kurulum dogrulaniyor..."
ssh "$TARGET" "systemctl is-active sepetarasi-metrics.timer && systemctl is-enabled sepetarasi-metrics.timer"
ssh "$TARGET" "systemctl is-active sepetarasi-boot-marker.service && systemctl is-enabled sepetarasi-boot-marker.service"
ssh "$TARGET" "systemctl is-active sepetarasi-audio-normalize.timer && systemctl is-enabled sepetarasi-audio-normalize.timer"
ssh "$TARGET" "command -v sepetarasi-health && command -v sepetarasi-audio-normalize.sh"

echo ""
echo "[4/4] Son metrik satirlari:"
ssh "$TARGET" "tail -n 6 /var/log/sepetarasi/system-metrics.log"
ssh "$TARGET" "ls -l /var/log/sepetarasi/audit.log"
ssh "$TARGET" "tail -n 12 /var/log/sepetarasi/audio-normalize.log"

echo ""
echo "Tamamlandi."
echo "Gece analiz komutlari:"
echo "  ssh $TARGET \"journalctl --list-boots --no-pager\""
echo "  ssh $TARGET \"journalctl -k --since '2026-04-15 20:00' --until '2026-04-16 08:00' --no-pager\""
echo "  ssh $TARGET \"awk '\$0 ~ /\\\"ts\\\":\\\"2026-04-15|\\\"ts\\\":\\\"2026-04-16/ {print}' /var/log/sepetarasi/system-metrics.log\""
echo "  ssh $TARGET \"tail -n 20 /var/log/sepetarasi/audit.log\""
