#!/bin/bash
# OWS Intelligence Wire — Demo Recording Script
# Records terminal demo via asciinema, converts to GIF/MP4

set -e

DEMO_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="$DEMO_DIR/output"
mkdir -p "$OUTPUT_DIR"

CAST_FILE="$OUTPUT_DIR/ows-demo.cast"
GIF_FILE="$OUTPUT_DIR/ows-demo.gif"
MP4_FILE="$OUTPUT_DIR/ows-demo.mp4"

echo "🎬 OWS Intelligence Wire — Demo Recording"
echo "==========================================="
echo ""

# Step 1: Record with asciinema
echo "📹 Step 1: Recording terminal demo..."
echo "   Output: $CAST_FILE"
echo ""

asciinema rec "$CAST_FILE" \
  --cols 80 \
  --rows 30 \
  --title "OWS Intelligence Wire — DeFi AI Agent Demo" \
  --command "python3 $DEMO_DIR/demo.py" \
  --overwrite

echo ""
echo "✅ Recording saved: $CAST_FILE"
echo ""

# Step 2: Convert to GIF (if agg is available)
if command -v agg &>/dev/null; then
  echo "🖼️  Step 2: Converting to GIF..."
  agg "$CAST_FILE" "$GIF_FILE" --font-size 16 --theme monokai
  echo "✅ GIF saved: $GIF_FILE"
elif command -v npx &>/dev/null; then
  echo "🖼️  Step 2: Converting to GIF via svg-term..."
  npx --yes svg-term-cli --in "$CAST_FILE" --out "$OUTPUT_DIR/ows-demo.svg" --window --width 80 --height 30
  echo "✅ SVG saved: $OUTPUT_DIR/ows-demo.svg"
else
  echo "⚠️  Step 2: No GIF converter found (install 'agg' or use svg-term)"
  echo "   brew install agg"
fi

# Step 3: Convert to MP4 (if ffmpeg is available)
if [ -f "$GIF_FILE" ] && command -v ffmpeg &>/dev/null; then
  echo ""
  echo "🎥 Step 3: Converting GIF to MP4..."
  ffmpeg -i "$GIF_FILE" \
    -movflags faststart \
    -pix_fmt yuv420p \
    -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" \
    -y "$MP4_FILE" 2>/dev/null
  echo "✅ MP4 saved: $MP4_FILE"
fi

echo ""
echo "📦 Output files:"
ls -lh "$OUTPUT_DIR/"
echo ""
echo "🎉 Done! You can:"
echo "   • Play: asciinema play $CAST_FILE"
echo "   • Upload: asciinema upload $CAST_FILE"
echo "   • Convert to GIF: brew install agg && agg $CAST_FILE $GIF_FILE"
