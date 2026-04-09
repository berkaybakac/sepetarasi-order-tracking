#!/bin/bash

# Sepet Arası Icon Generator
# Uses sips and iconutil (macOS native) to generate high-quality icons.

SOURCE_PNG=$1
DEST_DIR=$2

if [ -z "$SOURCE_PNG" ] || [ -z "$DEST_DIR" ]; then
    echo "Usage: ./generate-icons.sh <source_png> <destination_directory>"
    exit 1
fi

echo "Generating icons from $SOURCE_PNG to $DEST_DIR"

ICONSET_DIR="$DEST_DIR/icon.iconset"
mkdir -p "$ICONSET_DIR"

# Generate various sizes for icns
sips -s format png -z 16 16     "$SOURCE_PNG" --out "$ICONSET_DIR/icon_16x16.png"
sips -s format png -z 32 32     "$SOURCE_PNG" --out "$ICONSET_DIR/icon_16x16@2x.png"
sips -s format png -z 32 32     "$SOURCE_PNG" --out "$ICONSET_DIR/icon_32x32.png"
sips -s format png -z 64 64     "$SOURCE_PNG" --out "$ICONSET_DIR/icon_32x32@2x.png"
sips -s format png -z 128 128   "$SOURCE_PNG" --out "$ICONSET_DIR/icon_128x128.png"
sips -s format png -z 256 256   "$SOURCE_PNG" --out "$ICONSET_DIR/icon_128x128@2x.png"
sips -s format png -z 256 256   "$SOURCE_PNG" --out "$ICONSET_DIR/icon_256x256.png"
sips -s format png -z 512 512   "$SOURCE_PNG" --out "$ICONSET_DIR/icon_256x256@2x.png"
sips -s format png -z 512 512   "$SOURCE_PNG" --out "$ICONSET_DIR/icon_512x512.png"
sips -s format png -z 1024 1024 "$SOURCE_PNG" --out "$ICONSET_DIR/icon_512x512@2x.png"

# Create .icns file
iconutil -c icns "$ICONSET_DIR" -o "$DEST_DIR/icon.icns"

# Clean up iconset directory
rm -rf "$ICONSET_DIR"

echo "Generated icon.icns and kept source icon.png in $DEST_DIR"
