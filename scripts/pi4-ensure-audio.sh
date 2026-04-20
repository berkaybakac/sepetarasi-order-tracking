#!/usr/bin/env bash
set -euo pipefail

audio_device="${1:-${AUDIO_ALSA_DEVICE:-}}"

if [ -z "$audio_device" ]; then
	echo "[audio-init] AUDIO_ALSA_DEVICE missing; skipping mixer normalization"
	exit 0
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

card=""
if ! card="$(resolve_card "$audio_device")"; then
	echo "[audio-init] Could not resolve ALSA card from AUDIO_ALSA_DEVICE=$audio_device; skipping"
	exit 0
fi

# Raspberry Pi analog output commonly exposes PCM. Keep a few fallbacks for
# different cards so every service restart reasserts a sane output level.
for control in PCM Headphone Speaker Master; do
	if amixer -c "$card" sset "$control" 100% unmute >/dev/null 2>&1; then
		echo "[audio-init] Set ALSA control to 100%: card=$card control=$control device=$audio_device"
		exit 0
	fi
	if amixer -c "$card" sset "$control" 100% >/dev/null 2>&1; then
		echo "[audio-init] Set ALSA control to 100%: card=$card control=$control device=$audio_device"
		exit 0
	fi
done

echo "[audio-init] No supported mixer control found for card=$card device=$audio_device"
exit 0
