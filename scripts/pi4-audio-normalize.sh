#!/usr/bin/env bash
set -euo pipefail

LOG_DIR="${SEPETARASI_LOG_DIR:-/var/log/sepetarasi}"
LOG_FILE="${SEPETARASI_AUDIO_NORMALIZE_LOG:-$LOG_DIR/audio-normalize.log}"
AUDIO_DEVICE="${1:-${AUDIO_ALSA_DEVICE:-plughw:CARD=Headphones,DEV=0}}"
AUDIO_LEVEL="${SEPETARASI_AUDIO_BASELINE_PCT:-90}"
PIPEWIRE_USER="${SEPETARASI_PIPEWIRE_USER:-}"

mkdir -p "$LOG_DIR" 2>/dev/null || true

log() {
	local level="$1"
	local msg="$2"
	local ts
	ts="$(date -Iseconds)"
	if ! printf '%s [%s] %s\n' "$ts" "$level" "$msg" >> "$LOG_FILE" 2>/dev/null; then
		printf '%s [%s] %s\n' "$ts" "$level" "$msg"
	fi
}

if ! [[ "$AUDIO_LEVEL" =~ ^[0-9]+$ ]] || ((AUDIO_LEVEL < 0 || AUDIO_LEVEL > 100)); then
	log "warn" "Invalid SEPETARASI_AUDIO_BASELINE_PCT=$AUDIO_LEVEL; using 90"
	AUDIO_LEVEL=90
fi

resolve_card() {
	local device="$1"

	if [[ "$device" =~ CARD=([^,]+) ]]; then
		printf '%s\n' "${BASH_REMATCH[1]}"
		return 0
	fi

	if [[ "$device" =~ ^(plug)?hw:([0-9]+),([0-9]+)$ ]]; then
		printf '%s\n' "${BASH_REMATCH[2]}"
		return 0
	fi

	return 1
}

run_wpctl() {
	if ! command -v wpctl >/dev/null 2>&1; then
		return 127
	fi

	if [[ -n "$PIPEWIRE_USER" && "$(id -u)" == "0" ]] && id "$PIPEWIRE_USER" >/dev/null 2>&1; then
		local pipewire_uid
		local pipewire_runtime_dir
		pipewire_uid="$(id -u "$PIPEWIRE_USER")"
		pipewire_runtime_dir="${SEPETARASI_PIPEWIRE_RUNTIME_DIR:-/run/user/$pipewire_uid}"

		if command -v runuser >/dev/null 2>&1; then
			runuser -u "$PIPEWIRE_USER" -- env XDG_RUNTIME_DIR="$pipewire_runtime_dir" wpctl "$@"
			return $?
		fi
		if command -v sudo >/dev/null 2>&1; then
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

log "info" "Starting audio normalize: device=$AUDIO_DEVICE level=${AUDIO_LEVEL}%"

card=""
if card="$(resolve_card "$AUDIO_DEVICE")"; then
	alsa_done=0
	for control in PCM Headphone Speaker Master; do
		if amixer -c "$card" sset "$control" "$AUDIO_LEVEL%" unmute >/dev/null 2>&1; then
			log "info" "Set ALSA control: card=$card control=$control level=${AUDIO_LEVEL}% unmute"
			alsa_done=1
			break
		fi
		if amixer -c "$card" sset "$control" "$AUDIO_LEVEL%" >/dev/null 2>&1; then
			log "info" "Set ALSA control: card=$card control=$control level=${AUDIO_LEVEL}%"
			alsa_done=1
			break
		fi
	done

	if [[ "$alsa_done" == "0" ]]; then
		log "warn" "No supported ALSA mixer control found: card=$card device=$AUDIO_DEVICE"
	fi
else
	log "warn" "Could not resolve ALSA card from AUDIO_ALSA_DEVICE=$AUDIO_DEVICE"
fi

pipewire_level="$(awk -v pct="$AUDIO_LEVEL" 'BEGIN { printf "%.2f", pct / 100 }')"
if run_wpctl set-volume @DEFAULT_AUDIO_SINK@ "$pipewire_level" >/dev/null 2>&1; then
	volume_after="$(run_wpctl get-volume @DEFAULT_AUDIO_SINK@ 2>/dev/null || true)"
	log "info" "Set PipeWire default sink: target=$pipewire_level after=${volume_after:-unknown}"
else
	log "warn" "PipeWire default sink volume could not be set"
fi

if command -v alsactl >/dev/null 2>&1; then
	if alsactl store >/dev/null 2>&1; then
		log "info" "Stored ALSA mixer state"
	else
		log "warn" "alsactl store failed"
	fi
fi

alsa_after=""
if [[ -n "${card:-}" ]]; then
	alsa_after="$(amixer -c "$card" sget PCM 2>/dev/null | sed -n 's/.*\[\([0-9][0-9]*%\)\].*/\1/p' | head -n 1 || true)"
fi
log "info" "Audio normalize complete: alsa_pcm=${alsa_after:-unknown} pipewire_target=$pipewire_level"
