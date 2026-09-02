#!/usr/bin/env bash
# Renders every composition to out/. Each one takes about 20-30 seconds on an M-series
# Mac; the first run also downloads a headless Chrome (~95 MB).
set -euo pipefail
cd "$(dirname "$0")"

mkdir -p out
npx remotion compositions src/index.ts --quiet 2>/dev/null | awk 'NF && $1 !~ /^(The|Getting|Got)/ {print $1}' \
  | while read -r id; do
      echo "→ $id"
      npx remotion render src/index.ts "$id" "out/$id.mp4" --log=error
    done

echo
echo "rendered:"
ls -1 out/*.mp4
