#!/usr/bin/env bash
# Bundle php-portal/ into public/php-portal.zip for direct Hostinger upload.
#
# The zip's contents are flat — extracting it inside public_html/ produces:
#   public_html/index.php, login.php, app/, assets/, includes/, vendor/, ...
# i.e. NO outer wrapper folder. Single-folder deployment.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/php-portal"
OUT="$ROOT/public/php-portal.zip"

test -d "$SRC" || { echo "missing $SRC"; exit 1; }
mkdir -p "$ROOT/public"
rm -f "$OUT"

# Zip from inside php-portal/ so paths are relative to the deployment root.
cd "$SRC"
nix run nixpkgs#zip -- -rq "$OUT" . \
  -x "config.php" \
  -x "*/.DS_Store" \
  -x "*/.git/*" \
  -x "*/node_modules/*"

SIZE=$(du -h "$OUT" | cut -f1)
echo "Built $OUT ($SIZE)"