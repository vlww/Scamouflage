#!/bin/sh
# Renders the Chrome Web Store images into store/out/ with headless Chrome.
set -e
cd "$(dirname "$0")"
mkdir -p out
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PAGE="file://$(pwd)/make.html"
shot() { # name width height query
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --user-data-dir="$(mktemp -d)" --allow-file-access-from-files --virtual-time-budget=3000 \
    --window-size="$2,$3" --screenshot="$(pwd)/out/$1.png" "$PAGE?$4" 2>/dev/null
  echo "out/$1.png"
}
for s in 1 2 3 4; do shot "screenshot-$s" 1280 800 "s=$s"; done
shot promo-small 880 560 "tile=small&zoom=2" >/dev/null
sips -z 280 440 out/promo-small.png >/dev/null && echo out/promo-small.png
shot promo-marquee 1400 560 "tile=marquee"
