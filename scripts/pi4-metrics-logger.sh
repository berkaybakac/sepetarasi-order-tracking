#!/usr/bin/env bash
set -euo pipefail

EVENT="${1:-sample}"
LOG_DIR="${SEPETARASI_METRICS_LOG_DIR:-/var/log/sepetarasi}"
LOG_FILE="${SEPETARASI_METRICS_LOG_FILE:-$LOG_DIR/system-metrics.log}"
APP_HOST="${SEPETARASI_APP_HOST:-127.0.0.1}"
APP_PORT="${SEPETARASI_APP_PORT:-3000}"
GATEWAY_PING_TIMEOUT="${SEPETARASI_GATEWAY_PING_TIMEOUT:-1}"
HTTP_TIMEOUT="${SEPETARASI_HTTP_TIMEOUT:-3}"
CONNECTIVITY_URL="${SEPETARASI_CONNECTIVITY_URL:-http://connectivitycheck.gstatic.com/generate_204}"
APP_HEALTH_URL="${SEPETARASI_APP_HEALTH_URL:-http://$APP_HOST:$APP_PORT/health}"
PRIMARY_IFACE="${SEPETARASI_PRIMARY_IFACE:-eth0}"
AUDIO_CARD="${SEPETARASI_AUDIO_CARD:-Headphones}"
AUDIO_CONTROL="${SEPETARASI_AUDIO_CONTROL:-PCM}"
PIPEWIRE_USER="${SEPETARASI_PIPEWIRE_USER:-}"

mkdir -p "$LOG_DIR"

iso_now() {
	date -Iseconds
}

json_escape() {
	printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

number_or_null() {
	local value="${1:-}"
	if [[ -z "$value" ]]; then
		printf 'null'
	else
		printf '%s' "$value"
	fi
}

string_or_null() {
	local value="${1:-}"
	if [[ -z "$value" ]]; then
		printf 'null'
	else
		printf '"%s"' "$(json_escape "$value")"
	fi
}

throttle_bit() {
	local value="${1:-}"
	local mask="$2"
	if [[ "$value" =~ ^0x[0-9a-fA-F]+$ ]]; then
		local hex_value="${value#0x}"
		if (( (16#$hex_value & mask) != 0 )); then
			printf '1'
		else
			printf '0'
		fi
	else
		printf 'null'
	fi
}

first_percent_from_amixer() {
	sed -n 's/.*\[\([0-9][0-9]*\)%\].*/\1/p' | head -n 1
}

wpctl_get_volume() {
	if ! command -v wpctl >/dev/null 2>&1; then
		return 0
	fi
	if [[ -n "$PIPEWIRE_USER" && "$(id -u)" == "0" ]] && id "$PIPEWIRE_USER" >/dev/null 2>&1; then
		local pipewire_uid
		local pipewire_runtime_dir
		pipewire_uid="$(id -u "$PIPEWIRE_USER")"
		pipewire_runtime_dir="${SEPETARASI_PIPEWIRE_RUNTIME_DIR:-/run/user/$pipewire_uid}"

		if command -v runuser >/dev/null 2>&1; then
			runuser -u "$PIPEWIRE_USER" -- env XDG_RUNTIME_DIR="$pipewire_runtime_dir" wpctl get-volume @DEFAULT_AUDIO_SINK@ 2>/dev/null || true
			return 0
		fi
		if command -v sudo >/dev/null 2>&1; then
			sudo -u "$PIPEWIRE_USER" XDG_RUNTIME_DIR="$pipewire_runtime_dir" wpctl get-volume @DEFAULT_AUDIO_SINK@ 2>/dev/null || true
			return 0
		fi
	fi
	if [[ -d /run/user/1000 ]]; then
		XDG_RUNTIME_DIR=/run/user/1000 wpctl get-volume @DEFAULT_AUDIO_SINK@ 2>/dev/null || true
	else
		wpctl get-volume @DEFAULT_AUDIO_SINK@ 2>/dev/null || true
	fi
}

ts="$(iso_now)"
epoch="$(date +%s)"
boot_id="$(cat /proc/sys/kernel/random/boot_id 2>/dev/null || true)"
uptime_s="$(cut -d. -f1 /proc/uptime 2>/dev/null || true)"

read -r load1 load5 load15 _ < /proc/loadavg

mem_total_kb="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)"
mem_available_kb="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)"
swap_total_kb="$(awk '/^SwapTotal:/ {print $2}' /proc/meminfo)"
swap_free_kb="$(awk '/^SwapFree:/ {print $2}' /proc/meminfo)"

cpu_temp_c=""
throttled_raw=""

if command -v vcgencmd >/dev/null 2>&1; then
	temp_output="$(vcgencmd measure_temp 2>/dev/null || true)"
	cpu_temp_c="$(printf '%s' "$temp_output" | sed -n "s/^temp=\([0-9.]*\)'C$/\1/p")"
	throttled_output="$(vcgencmd get_throttled 2>/dev/null || true)"
	throttled_raw="${throttled_output#throttled=}"
fi

if [[ -z "$cpu_temp_c" ]] && [[ -r /sys/class/thermal/thermal_zone0/temp ]]; then
	temp_milli="$(cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null || true)"
	if [[ -n "$temp_milli" ]]; then
		cpu_temp_c="$(awk -v t="$temp_milli" 'BEGIN { printf "%.1f", t / 1000 }')"
	fi
fi

throttled_nonzero=0
if [[ -n "$throttled_raw" ]]; then
	if [[ "$throttled_raw" =~ ^0x[0-9a-fA-F]+$ ]]; then
		hex_value="${throttled_raw#0x}"
		if ((16#$hex_value > 0)); then
			throttled_nonzero=1
		fi
	elif [[ "$throttled_raw" != "0" ]]; then
		throttled_nonzero=1
	fi
fi

throttled_under_voltage_now="$(throttle_bit "$throttled_raw" 1)"
throttled_frequency_capped_now="$(throttle_bit "$throttled_raw" 2)"
throttled_throttled_now="$(throttle_bit "$throttled_raw" 4)"
throttled_soft_temp_limit_now="$(throttle_bit "$throttled_raw" 8)"
throttled_under_voltage_occurred="$(throttle_bit "$throttled_raw" 65536)"
throttled_frequency_capped_occurred="$(throttle_bit "$throttled_raw" 131072)"
throttled_throttled_occurred="$(throttle_bit "$throttled_raw" 262144)"
throttled_soft_temp_limit_occurred="$(throttle_bit "$throttled_raw" 524288)"

server_pid="$(pgrep -o -f 'node .*packages/server/dist/server.js|tsx .*packages/server/src/server.ts' || true)"
server_cpu_pct=""
server_mem_pct=""
server_rss_kb=""
server_vsz_kb=""
server_etime=""
server_comm=""

if [[ -n "$server_pid" ]]; then
	read -r server_cpu_pct server_mem_pct server_rss_kb server_vsz_kb server_etime server_comm < <(
		ps -p "$server_pid" -o %cpu=,%mem=,rss=,vsz=,etime=,comm= | awk '{$1=$1; print}'
	)
fi

established_to_port="$(ss -Htan 2>/dev/null | awk -v p=":${APP_PORT}$" '$1=="ESTAB" && $4 ~ p {c++} END {print c+0}')"
listen_on_port="$(ss -Htan 2>/dev/null | awk -v p=":${APP_PORT}$" '$1=="LISTEN" && $4 ~ p {c++} END {print c+0}')"

eth0_ip="$(ip -o -4 addr show dev "$PRIMARY_IFACE" 2>/dev/null | awk '{print $4}' | paste -sd, -)"
eth0_mac="$(cat "/sys/class/net/$PRIMARY_IFACE/address" 2>/dev/null || true)"
eth0_operstate="$(cat "/sys/class/net/$PRIMARY_IFACE/operstate" 2>/dev/null || true)"
gateway="$(ip route show default 2>/dev/null | awk '/^default / {print $3; exit}')"
dns="$(awk '/^nameserver[[:space:]]+/ {print $2}' /etc/resolv.conf 2>/dev/null | paste -sd, -)"

gateway_ping_ok=""
if [[ -n "$gateway" ]] && command -v ping >/dev/null 2>&1; then
	if ping -c 1 -W "$GATEWAY_PING_TIMEOUT" "$gateway" >/dev/null 2>&1; then
		gateway_ping_ok=1
	else
		gateway_ping_ok=0
	fi
fi

dns_ok=""
if command -v getent >/dev/null 2>&1; then
	if getent hosts connectivitycheck.gstatic.com >/dev/null 2>&1; then
		dns_ok=1
	else
		dns_ok=0
	fi
fi

internet_http_status=""
internet_http_ok=""
if command -v curl >/dev/null 2>&1; then
	internet_http_status="$(curl -sS --max-time "$HTTP_TIMEOUT" -o /dev/null -w '%{http_code}' "$CONNECTIVITY_URL" 2>/dev/null || true)"
	if [[ "$internet_http_status" == "204" || "$internet_http_status" == "200" ]]; then
		internet_http_ok=1
	else
		internet_http_ok=0
	fi
fi

app_health_status=""
app_health_ok=""
if command -v curl >/dev/null 2>&1; then
	app_health_status="$(curl -sS --max-time "$HTTP_TIMEOUT" -o /dev/null -w '%{http_code}' "$APP_HEALTH_URL" 2>/dev/null || true)"
	if [[ "$app_health_status" == "200" ]]; then
		app_health_ok=1
	else
		app_health_ok=0
	fi
fi

duplicate_ip_recent=""
duplicate_ip_last=""
if command -v journalctl >/dev/null 2>&1; then
	duplicate_ip_last="$(
		journalctl -u NetworkManager --since '15 min ago' --no-pager -g 'already in use' 2>/dev/null |
			grep 'already in use' |
			tail -n 1 || true
	)"
	if [[ -n "$duplicate_ip_last" ]]; then
		duplicate_ip_recent=1
	else
		duplicate_ip_recent=0
	fi
fi

alsa_headphones_pcm_pct=""
alsa_headphones_pcm_muted=""
if command -v amixer >/dev/null 2>&1; then
	amixer_output="$(amixer -c "$AUDIO_CARD" sget "$AUDIO_CONTROL" 2>/dev/null || true)"
	alsa_headphones_pcm_pct="$(printf '%s\n' "$amixer_output" | first_percent_from_amixer)"
	if printf '%s\n' "$amixer_output" | grep -q '\[off\]'; then
		alsa_headphones_pcm_muted=1
	elif [[ -n "$amixer_output" ]]; then
		alsa_headphones_pcm_muted=0
	fi
fi

pipewire_default_sink_volume=""
pipewire_default_sink_muted=""
wpctl_output="$(wpctl_get_volume)"
if [[ -n "$wpctl_output" ]]; then
	pipewire_default_sink_volume="$(printf '%s\n' "$wpctl_output" | sed -n 's/^Volume:[[:space:]]*\([0-9.][0-9.]*\).*/\1/p' | head -n 1)"
	if printf '%s\n' "$wpctl_output" | grep -q 'MUTED'; then
		pipewire_default_sink_muted=1
	else
		pipewire_default_sink_muted=0
	fi
fi

log_line="$(
	printf '{'
	printf '"ts":"%s",' "$(json_escape "$ts")"
	printf '"epoch":%s,' "$(number_or_null "$epoch")"
	printf '"event":"%s",' "$(json_escape "$EVENT")"
	printf '"boot_id":%s,' "$(string_or_null "$boot_id")"
	printf '"uptime_s":%s,' "$(number_or_null "$uptime_s")"
	printf '"load1":%s,' "$(number_or_null "$load1")"
	printf '"load5":%s,' "$(number_or_null "$load5")"
	printf '"load15":%s,' "$(number_or_null "$load15")"
	printf '"cpu_temp_c":%s,' "$(number_or_null "$cpu_temp_c")"
	printf '"throttled_raw":%s,' "$(string_or_null "$throttled_raw")"
	printf '"throttled_nonzero":%s,' "$(number_or_null "$throttled_nonzero")"
	printf '"throttled_under_voltage_now":%s,' "$(number_or_null "$throttled_under_voltage_now")"
	printf '"throttled_frequency_capped_now":%s,' "$(number_or_null "$throttled_frequency_capped_now")"
	printf '"throttled_throttled_now":%s,' "$(number_or_null "$throttled_throttled_now")"
	printf '"throttled_soft_temp_limit_now":%s,' "$(number_or_null "$throttled_soft_temp_limit_now")"
	printf '"throttled_under_voltage_occurred":%s,' "$(number_or_null "$throttled_under_voltage_occurred")"
	printf '"throttled_frequency_capped_occurred":%s,' "$(number_or_null "$throttled_frequency_capped_occurred")"
	printf '"throttled_throttled_occurred":%s,' "$(number_or_null "$throttled_throttled_occurred")"
	printf '"throttled_soft_temp_limit_occurred":%s,' "$(number_or_null "$throttled_soft_temp_limit_occurred")"
	printf '"mem_total_kb":%s,' "$(number_or_null "$mem_total_kb")"
	printf '"mem_available_kb":%s,' "$(number_or_null "$mem_available_kb")"
	printf '"swap_total_kb":%s,' "$(number_or_null "$swap_total_kb")"
	printf '"swap_free_kb":%s,' "$(number_or_null "$swap_free_kb")"
	printf '"server_pid":%s,' "$(number_or_null "$server_pid")"
	printf '"server_cpu_pct":%s,' "$(number_or_null "$server_cpu_pct")"
	printf '"server_mem_pct":%s,' "$(number_or_null "$server_mem_pct")"
	printf '"server_rss_kb":%s,' "$(number_or_null "$server_rss_kb")"
	printf '"server_vsz_kb":%s,' "$(number_or_null "$server_vsz_kb")"
	printf '"server_etime":%s,' "$(string_or_null "$server_etime")"
	printf '"server_comm":%s,' "$(string_or_null "$server_comm")"
	printf '"tcp_established_to_app":%s,' "$(number_or_null "$established_to_port")"
	printf '"tcp_listen_on_app":%s,' "$(number_or_null "$listen_on_port")"
	printf '"eth0_ip":%s,' "$(string_or_null "$eth0_ip")"
	printf '"eth0_mac":%s,' "$(string_or_null "$eth0_mac")"
	printf '"eth0_operstate":%s,' "$(string_or_null "$eth0_operstate")"
	printf '"gateway":%s,' "$(string_or_null "$gateway")"
	printf '"dns":%s,' "$(string_or_null "$dns")"
	printf '"gateway_ping_ok":%s,' "$(number_or_null "$gateway_ping_ok")"
	printf '"dns_ok":%s,' "$(number_or_null "$dns_ok")"
	printf '"internet_http_ok":%s,' "$(number_or_null "$internet_http_ok")"
	printf '"internet_http_status":%s,' "$(string_or_null "$internet_http_status")"
	printf '"app_health_ok":%s,' "$(number_or_null "$app_health_ok")"
	printf '"app_health_status":%s,' "$(string_or_null "$app_health_status")"
	printf '"duplicate_ip_recent":%s,' "$(number_or_null "$duplicate_ip_recent")"
	printf '"duplicate_ip_last":%s,' "$(string_or_null "$duplicate_ip_last")"
	printf '"alsa_headphones_pcm_pct":%s,' "$(number_or_null "$alsa_headphones_pcm_pct")"
	printf '"alsa_headphones_pcm_muted":%s,' "$(number_or_null "$alsa_headphones_pcm_muted")"
	printf '"pipewire_default_sink_volume":%s,' "$(number_or_null "$pipewire_default_sink_volume")"
	printf '"pipewire_default_sink_muted":%s' "$(number_or_null "$pipewire_default_sink_muted")"
	printf '}'
)"

printf '%s\n' "$log_line" >> "$LOG_FILE"
