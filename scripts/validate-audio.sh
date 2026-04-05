#!/usr/bin/env bash
# Validate announcement assets:
# - Must contain exactly 1.mp3 ... 400.mp3
# - No missing numbers
# - No out-of-range or non-numeric *.mp3 files
# - Optional: if ffprobe exists, ensure each file has a positive duration

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
AUDIO_DIR="${1:-$REPO_ROOT/packages/server/assets/announcements}"
START=1
END=400

if [[ ! -d "$AUDIO_DIR" ]]; then
  echo "HATA: Dizin bulunamadı: $AUDIO_DIR"
  exit 1
fi

missing_count=0
invalid_duration_count=0
extra_count=0

missing_preview=()
invalid_preview=()
extra_preview=()

# 1) Ensure all expected files exist (1..400)
for n in $(seq "$START" "$END"); do
  file="$AUDIO_DIR/$n.mp3"
  if [[ ! -f "$file" ]]; then
    missing_count=$((missing_count + 1))
    if [[ ${#missing_preview[@]} -lt 10 ]]; then
      missing_preview+=("$n.mp3")
    fi
  fi
done

# 2) Ensure there are no extra/out-of-range MP3 names
for file in "$AUDIO_DIR"/*.mp3; do
  if [[ ! -e "$file" ]]; then
    break
  fi

  base="$(basename "$file")"
  stem="${base%.mp3}"

  if [[ ! "$stem" =~ ^[0-9]+$ ]]; then
    extra_count=$((extra_count + 1))
    if [[ ${#extra_preview[@]} -lt 10 ]]; then
      extra_preview+=("$base")
    fi
    continue
  fi

  if (( stem < START || stem > END )); then
    extra_count=$((extra_count + 1))
    if [[ ${#extra_preview[@]} -lt 10 ]]; then
      extra_preview+=("$base")
    fi
  fi
done

# 3) Optional duration validation
has_ffprobe=false
if command -v ffprobe >/dev/null 2>&1; then
  has_ffprobe=true
fi

if [[ "$has_ffprobe" == "true" ]]; then
  for n in $(seq "$START" "$END"); do
    file="$AUDIO_DIR/$n.mp3"
    if [[ ! -f "$file" ]]; then
      continue
    fi

    duration="$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$file" 2>/dev/null || true)"
    # duration must be numeric and > 0.05s
    if [[ -z "$duration" ]] || ! awk "BEGIN { exit(!($duration > 0.05)) }"; then
      invalid_duration_count=$((invalid_duration_count + 1))
      if [[ ${#invalid_preview[@]} -lt 10 ]]; then
        invalid_preview+=("$n.mp3")
      fi
    fi
  done
fi

total_mp3="$(find "$AUDIO_DIR" -maxdepth 1 -type f -name '*.mp3' | wc -l | tr -d ' ')"

echo "Audio doğrulama: $AUDIO_DIR"
echo "Toplam *.mp3: $total_mp3"
echo "Beklenen aralık: $START..$END"

if (( missing_count > 0 )); then
  echo "HATA: Eksik dosya sayısı: $missing_count"
  echo "Örnek eksikler: ${missing_preview[*]}"
fi

if (( extra_count > 0 )); then
  echo "HATA: Aralık dışı/geçersiz isimli dosya sayısı: $extra_count"
  echo "Örnekler: ${extra_preview[*]}"
fi

if [[ "$has_ffprobe" == "true" ]]; then
  if (( invalid_duration_count > 0 )); then
    echo "HATA: Geçersiz/0s dosya sayısı: $invalid_duration_count"
    echo "Örnekler: ${invalid_preview[*]}"
  fi
else
  echo "UYARI: ffprobe bulunamadı, süre/bozuk dosya kontrolü atlandı."
fi

if (( missing_count == 0 && extra_count == 0 && invalid_duration_count == 0 )); then
  echo "OK: Ses dosyaları 1..400 eksiksiz ve tutarlı."
  exit 0
fi

exit 1
