#!/usr/bin/env bash
# generate-audio.sh
# macOS'ta say + ffmpeg kullanarak 1-400 arası sipariş anons MP3'lerini üretir.
# Çıktı: packages/server/assets/announcements/{n}.mp3
# Kullanım: bash scripts/generate-audio.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="$REPO_ROOT/packages/server/assets/announcements"
START=1
END=400
VOICE="${VOICE:-Yelda}"

is_valid_mp3() {
  local file="$1"
  ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$file" >/dev/null 2>&1
}

# ── Ön koşul kontrolü ─────────────────────────────────────────────────────────
if [[ "$(uname)" != "Darwin" ]]; then
  echo "HATA: Bu script yalnızca macOS'ta çalışır (say komutu gerekiyor)."
  exit 1
fi

if ! command -v say &>/dev/null; then
  echo "HATA: 'say' komutu bulunamadı. macOS Monterey+ gereklidir."
  exit 1
fi

if ! command -v ffmpeg &>/dev/null; then
  echo "HATA: 'ffmpeg' bulunamadı. Kurulum: brew install ffmpeg"
  exit 1
fi

if ! command -v ffprobe &>/dev/null; then
  echo "HATA: 'ffprobe' bulunamadı. Kurulum: brew install ffmpeg"
  exit 1
fi

# Seçili ses var mı?
if ! say -v "$VOICE" "" &>/dev/null 2>&1; then
  echo "HATA: '$VOICE' sesi bulunamadı."
  echo "      Sistem > Ses > Sesleri Yönet bölümünden ilgili sesi yükleyin."
  echo "      Alternatif: VOICE ile başka ses seçebilirsiniz."
  echo "      Örnek: VOICE='Yelda' bash scripts/generate-audio.sh"
  exit 1
fi

# ── Dizin hazırla ─────────────────────────────────────────────────────────────
mkdir -p "$OUT_DIR"

# ── Üretim döngüsü ────────────────────────────────────────────────────────────
TOTAL=$((END - START + 1))
GENERATED=0
SKIPPED=0

echo "Ses dosyaları üretiliyor: $OUT_DIR"
echo "Toplam: $TOTAL dosya (1.mp3 … ${END}.mp3)"
echo ""

for n in $(seq "$START" "$END"); do
  MP3="$OUT_DIR/${n}.mp3"

  if [[ -f "$MP3" ]]; then
    if is_valid_mp3 "$MP3"; then
      SKIPPED=$((SKIPPED + 1))
      continue
    fi
    echo ""
    echo "UYARI: Geçersiz MP3 bulundu, yeniden üretilecek: $MP3"
    rm -f "$MP3"
  fi

  TEXT="${n} numaralı sipariş hazır"
  AIFF="$(mktemp "/tmp/sepetarasi_audio_${n}_XXXXXX.aiff")"

  say -v "$VOICE" -o "$AIFF" "$TEXT"
  AIFF_SIZE=$(wc -c < "$AIFF" | tr -d ' ')
  if [[ "$AIFF_SIZE" -le 4096 ]]; then
    rm -f "$AIFF" "$MP3"
    echo ""
    echo "HATA: say boş/eksik çıktı üretti (ses: $VOICE, sipariş: $n, AIFF byte: $AIFF_SIZE)."
    echo "      Bu durumda MP3 dosyaları 0 saniye olur."
    echo "      Çözüm:"
    echo "      1) macOS sesini tam indir (Sistem > Ses > Sesleri Yönet)."
    echo "      2) test et: say -v \"$VOICE\" -o /tmp/test.aiff \"Merhaba\""
    echo "      3) sonra scripti tekrar çalıştır."
    exit 1
  fi

  ffmpeg -y -loglevel error -i "$AIFF" -vn -codec:a libmp3lame -ar 22050 -b:a 64k "$MP3"
  rm -f "$AIFF"

  if ! is_valid_mp3 "$MP3"; then
    rm -f "$MP3"
    echo ""
    echo "HATA: Üretilen MP3 geçersiz (sipariş: $n)."
    echo "      ffmpeg/say zinciri bu ortamda çalışmıyor olabilir."
    exit 1
  fi

  GENERATED=$((GENERATED + 1))
  DONE=$((SKIPPED + GENERATED))
  printf "\r[%d/%d] %d.mp3" "$DONE" "$TOTAL" "$n"
done

echo ""
echo ""
echo "Tamamlandı: $GENERATED yeni dosya üretildi, $SKIPPED mevcut geçerli dosya atlandı."
echo "Toplam: $(ls "$OUT_DIR"/*.mp3 2>/dev/null | wc -l | tr -d ' ') dosya mevcut."
echo "Dinleme testi: afplay \"$OUT_DIR/1.mp3\""
