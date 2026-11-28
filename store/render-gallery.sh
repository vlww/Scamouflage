#!/bin/sh
# Renders the Devpost thumbnail and gallery images (3:2, 1500×1000 PNG) into store/gallery/.
set -e
cd "$(dirname "$0")"
mkdir -p gallery
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
shoot() { # page query out width height
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --user-data-dir="$(mktemp -d)" --allow-file-access-from-files --virtual-time-budget=3000 \
    --window-size="$4,$5" --screenshot="$(pwd)/$3" "file://$(pwd)/$1?$2" 2>/dev/null
}
# A still of the finished stats card, used on gallery image 7.
shoot ../scripts/banners/stats.html "bare=1" ../docs/banners/stats-still.png 1200 360
shoot gallery.html "s=thumb" gallery/thumbnail.png 1500 1000
echo gallery/thumbnail.png
shoot gallery.html "s=thumb16" gallery/thumbnail-16x9.png 1280 720   # YouTube
echo gallery/thumbnail-16x9.png
for s in 1 2 3 4 5 6 7 8; do
  shoot gallery.html "s=$s" "gallery/gallery-$s.png" 1500 1000
  echo "gallery/gallery-$s.png"
done
