#!/usr/bin/env bash
set -euo pipefail

APP_HOST="${SEPETARASI_APP_HOST:-127.0.0.1}"
APP_PORT="${SEPETARASI_APP_PORT:-3000}"
APP_HEALTH_URL="${SEPETARASI_APP_HEALTH_URL:-http://$APP_HOST:$APP_PORT/health}"
CONNECTIVITY_URL="${SEPETARASI_CONNECTIVITY_URL:-http://connectivitycheck.gstatic.com/generate_204}"
HTTP_TIMEOUT="${SEPETARASI_HTTP_TIMEOUT:-3}"
GATEWAY_PING_TIMEOUT="${SEPETARASI_GATEWAY_PING_TIMEOUT:-1}"
PRIMARY_IFACE="${SEPETARASI_PRIMARY_IFACE:-eth0}"
AUDIO_CARD="${SEPETARASI_AUDIO_CARD:-Headphones}"
AUDIO_CONTROL="${SEPETARASI_AUDIO_CONTROL:-PCM}"
APP_DIR="${SEPETARASI_APP_DIR:-/opt/sepetarasi}"
ENV_FILE="${SEPETARASI_ENV_FILE:-$APP_DIR/.env}"
METRICS_LOG="${SEPETARASI_METRICS_LOG_FILE:-/var/log/sepetarasi/system-metrics.log}"
AUDIO_NORMALIZE_LOG="${SEPETARASI_AUDIO_NORMALIZE_LOG:-/var/log/sepetarasi/audio-normalize.log}"
PIPEWIRE_USER="${SEPETARASI_PIPEWIRE_USER:-}"

status_label() {
	local value="${1:-}"
	if [[ "$value" == "1" || "$value" == "ok" || "$value" == "active" || "$value" == "enabled" ]]; then
		printf 'OK'
	elif [[ -z "$value" ]]; then
		printf 'UNKNOWN'
	else
		printf 'FAIL'
	fi
}

command_exists() {
	command -v "$1" >/dev/null 2>&1
}

run_wpctl() {
	if ! command_exists wpctl; then
		return 127
	fi

	if [[ -n "$PIPEWIRE_USER" && "$(id -u)" == "0" ]] && id "$PIPEWIRE_USER" >/dev/null 2>&1; then
		local pipewire_uid
		local pipewire_runtime_dir
		pipewire_uid="$(id -u "$PIPEWIRE_USER")"
		pipewire_runtime_dir="${SEPETARASI_PIPEWIRE_RUNTIME_DIR:-/run/user/$pipewire_uid}"

		if command_exists runuser; then
			runuser -u "$PIPEWIRE_USER" -- env XDG_RUNTIME_DIR="$pipewire_runtime_dir" wpctl "$@"
			return $?
		fi
		if command_exists sudo; then
			sudo -u "$PIPEWIRE_USER" XDG_RUNTIME_DIR="$pipewire_runtime_dir" wpctl "$@"
			return $?
		fi
	fi

	if [[ -d /run/user/1000 ]]; then
		XDG_RUNTIME_DIR=/run/user/1000 wpctl "$@"
	else
		wpctl "$@"
	fi
}

first_percent_from_amixer() {
	sed -n 's/.*\[\([0-9][0-9]*\)%\].*/\1/p' | head -n 1
}

decode_throttled() {
	local raw="${1:-}"

	if [[ -z "$raw" ]]; then
		echo "  throttled: UNKNOWN (vcgencmd yok veya cevap yok)"
		return
	fi

	echo "  raw: $raw"

	if ! [[ "$raw" =~ ^0x[0-9a-fA-F]+$ ]]; then
		echo "  decode: UNKNOWN"
		return
	fi

	local hex="${raw#0x}"
	local value=$((16#$hex))

	if ((value == 0)); then
		echo "  decode: TEMIZ - bu boot icinde aktif/gecmis undervoltage veya throttling yok"
		return
	fi

	echo "  decode:"
	((value & 1)) && echo "    - SIMDI under-voltage var: Pi yeterli voltaj alamiyor"
	((value & 2)) && echo "    - SIMDI frequency capped: frekans kisitlanmis"
	((value & 4)) && echo "    - SIMDI throttling var: performans kisiliyor"
	((value & 8)) && echo "    - SIMDI soft temperature limit var"
	((value & 65536)) && echo "    - BU BOOT under-voltage gormus"
	((value & 131072)) && echo "    - BU BOOT frequency capped gormus"
	((value & 262144)) && echo "    - BU BOOT throttling gormus"
	((value & 524288)) && echo "    - BU BOOT soft temperature limit gormus"
}

print_header() {
	echo ""
	echo "== $1 =="
}

kv() {
	printf '  %-28s %s\n' "$1:" "${2:-UNKNOWN}"
}

hostname_value="$(hostname 2>/dev/null || true)"
model_value="$(tr -d '\0' < /proc/device-tree/model 2>/dev/null || true)"
now_value="$(date -Iseconds)"
boot_id="$(cat /proc/sys/kernel/random/boot_id 2>/dev/null || true)"
uptime_pretty="$(uptime -p 2>/dev/null || true)"

echo "Sepetarasi Pi Health Report"
kv "time" "$now_value"
kv "hostname" "$hostname_value"
kv "model" "$model_value"
kv "boot_id" "$boot_id"
kv "uptime" "$uptime_pretty"

print_header "Network / IP"
eth0_ip="$(ip -o -4 addr show dev "$PRIMARY_IFACE" 2>/dev/null | awk '{print $4}' | paste -sd, -)"
eth0_mac="$(cat "/sys/class/net/$PRIMARY_IFACE/address" 2>/dev/null || true)"
eth0_operstate="$(cat "/sys/class/net/$PRIMARY_IFACE/operstate" 2>/dev/null || true)"
gateway="$(ip route show default 2>/dev/null | awk '/^default / {print $3; exit}')"
dns="$(awk '/^nameserver[[:space:]]+/ {print $2}' /etc/resolv.conf 2>/dev/null | paste -sd, -)"
kv "$PRIMARY_IFACE ip" "$eth0_ip"
kv "$PRIMARY_IFACE mac" "$eth0_mac"
kv "$PRIMARY_IFACE state" "$eth0_operstate"
kv "gateway" "$gateway"
kv "dns" "$dns"

gateway_ping_ok=""
if [[ -n "$gateway" ]] && command_exists ping; then
	if ping -c 1 -W "$GATEWAY_PING_TIMEOUT" "$gateway" >/dev/null 2>&1; then
		gateway_ping_ok=1
	else
		gateway_ping_ok=0
	fi
fi
kv "gateway ping" "$(status_label "$gateway_ping_ok")"

dns_ok=""
if command_exists getent; then
	if getent hosts connectivitycheck.gstatic.com >/dev/null 2>&1; then
		dns_ok=1
	else
		dns_ok=0
	fi
fi
kv "dns resolve" "$(status_label "$dns_ok")"

internet_http_status=""
internet_http_ok=""
if command_exists curl; then
	internet_http_status="$(curl -sS --max-time "$HTTP_TIMEOUT" -o /dev/null -w '%{http_code}' "$CONNECTIVITY_URL" 2>/dev/null || true)"
	if [[ "$internet_http_status" == "204" || "$internet_http_status" == "200" ]]; then
		internet_http_ok=1
	else
		internet_http_ok=0
	fi
fi
kv "internet http" "$(status_label "$internet_http_ok") ($internet_http_status)"

echo "  duplicate IP recent:"
if command_exists journalctl; then
	duplicate_lines="$(journalctl -u NetworkManager --since '7 days ago' --no-pager -g 'already in use' 2>/dev/null | tail -n 10 || true)"
	if [[ -n "$duplicate_lines" ]]; then
		printf '%s\n' "$duplicate_lines" | sed 's/^/    /'
	else
		echo "    son 7 gunde NetworkManager duplicate IP logu yok"
	fi
else
	echo "    journalctl yok"
fi

print_header "App / Port"
service_active="$(systemctl is-active sepetarasi.service 2>/dev/null || true)"
service_enabled="$(systemctl is-enabled sepetarasi.service 2>/dev/null || true)"
kv "sepetarasi.service" "$service_active"
kv "service enabled" "$service_enabled"

listen_on_port="$(ss -Htan 2>/dev/null | awk -v p=":${APP_PORT}$" '$1=="LISTEN" && $4 ~ p {c++} END {print c+0}')"
kv "tcp listen :$APP_PORT" "$listen_on_port"

app_health_status=""
app_health_ok=""
if command_exists curl; then
	app_health_status="$(curl -sS --max-time "$HTTP_TIMEOUT" -o /dev/null -w '%{http_code}' "$APP_HEALTH_URL" 2>/dev/null || true)"
	if [[ "$app_health_status" == "200" ]]; then
		app_health_ok=1
	else
		app_health_ok=0
	fi
fi
kv "local /health" "$(status_label "$app_health_ok") ($app_health_status)"

if [[ -f "$ENV_FILE" ]]; then
	db_path="$(awk -F= '/^DB_PATH=/ {print $2}' "$ENV_FILE" | tail -n 1)"
		if [[ -n "${db_path:-}" && -f "$db_path" ]] && command_exists sqlite3; then
		echo "  app audio settings:"
		sqlite3 "$db_path" "select key || '=' || value from app_settings where key in ('audio_volume','music_volume','music_enabled','announcement_enabled') order by key;" 2>/dev/null |
			sed 's/^/    /' || true
	fi
fi

print_header "Guc / Voltaj / Boot"
throttled_raw=""
cpu_temp_c=""
if command_exists vcgencmd; then
	throttled_output="$(vcgencmd get_throttled 2>/dev/null || true)"
	throttled_raw="${throttled_output#throttled=}"
	temp_output="$(vcgencmd measure_temp 2>/dev/null || true)"
	cpu_temp_c="$(printf '%s' "$temp_output" | sed -n "s/^temp=\([0-9.]*\)'C$/\1/p")"
fi
if [[ -z "$cpu_temp_c" && -r /sys/class/thermal/thermal_zone0/temp ]]; then
	temp_milli="$(cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null || true)"
	[[ -n "$temp_milli" ]] && cpu_temp_c="$(awk -v t="$temp_milli" 'BEGIN { printf "%.1f", t / 1000 }')"
fi
decode_throttled "$throttled_raw"
kv "cpu temp C" "$cpu_temp_c"

echo "  recent boots:"
if command_exists journalctl; then
	journalctl --list-boots --no-pager 2>/dev/null | tail -n 8 | sed 's/^/    /' || true
else
	echo "    journalctl yok"
fi

echo "  recent power/journal warnings:"
if command_exists journalctl; then
	journalctl -k --since '7 days ago' --no-pager 2>/dev/null |
		grep -Ei 'under.?voltage|throttl|dirty bit|unclean|corrupt|voltage' |
		tail -n 15 |
		sed 's/^/    /' || echo "    son 7 gunde bariz kernel guc/journal uyarisi yok"
else
	echo "    journalctl yok"
fi

print_header "Disk / RAM"
df -h / 2>/dev/null | sed 's/^/  /' || true
free -h 2>/dev/null | sed 's/^/  /' || true

print_header "Ses"
alsa_output=""
alsa_pct=""
alsa_muted="UNKNOWN"
if command_exists amixer; then
	alsa_output="$(amixer -c "$AUDIO_CARD" sget "$AUDIO_CONTROL" 2>/dev/null || true)"
	alsa_pct="$(printf '%s\n' "$alsa_output" | first_percent_from_amixer)"
	if printf '%s\n' "$alsa_output" | grep -q '\[off\]'; then
		alsa_muted="MUTED"
	elif [[ -n "$alsa_output" ]]; then
		alsa_muted="unmuted"
	fi
fi
kv "ALSA $AUDIO_CARD/$AUDIO_CONTROL" "${alsa_pct:-UNKNOWN}% ($alsa_muted)"

pipewire_volume="$(run_wpctl get-volume @DEFAULT_AUDIO_SINK@ 2>/dev/null || true)"
kv "PipeWire default sink" "$pipewire_volume"

if [[ -f "$AUDIO_NORMALIZE_LOG" ]]; then
	echo "  audio-normalize last lines:"
	tail -n 8 "$AUDIO_NORMALIZE_LOG" 2>/dev/null | sed 's/^/    /' || true
else
	echo "  audio-normalize log: yok"
fi

print_header "Log / Metrics"
metrics_timer_active="$(systemctl is-active sepetarasi-metrics.timer 2>/dev/null || true)"
audio_timer_active="$(systemctl is-active sepetarasi-audio-normalize.timer 2>/dev/null || true)"
kv "metrics timer" "$metrics_timer_active"
kv "audio normalize timer" "$audio_timer_active"

if [[ -f "$METRICS_LOG" ]]; then
	kv "metrics log" "$METRICS_LOG"
	echo "  last metric:"
	tail -n 1 "$METRICS_LOG" 2>/dev/null | sed 's/^/    /' || true
else
	echo "  metrics log: yok"
fi

print_header "Recent Journal Problems"
if command_exists journalctl; then
	journalctl -p warning..alert --since '2 hours ago' --no-pager 2>/dev/null |
		tail -n 30 |
		sed 's/^/  /' || echo "  son 2 saatte warning/error yok"
else
	echo "  journalctl yok"
fi
