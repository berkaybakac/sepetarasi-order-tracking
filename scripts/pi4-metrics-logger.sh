#!/usr/bin/env bash
set -euo pipefail

EVENT="${1:-sample}"
LOG_DIR="${SEPETARASI_METRICS_LOG_DIR:-/var/log/sepetarasi}"
LOG_FILE="${SEPETARASI_METRICS_LOG_FILE:-$LOG_DIR/system-metrics.log}"
APP_PORT="${SEPETARASI_APP_PORT:-3000}"

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
		if ((16#${hex_value} > 0)); then
			throttled_nonzero=1
		fi
	elif [[ "$throttled_raw" != "0" ]]; then
		throttled_nonzero=1
	fi
fi

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
	printf '"tcp_listen_on_app":%s' "$(number_or_null "$listen_on_port")"
	printf '}'
)"

printf '%s\n' "$log_line" >> "$LOG_FILE"
