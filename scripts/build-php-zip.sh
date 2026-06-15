#!/usr/bin/env bash
# Bundle php-portal/ into public/php-portal.zip for direct Hostinger upload.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/php-portal"
OUT="$ROOT/public/php-portal.zip"

test -d "$SRC" || { echo "missing $SRC"; exit 1; }
mkdir -p "$ROOT/public"
rm -f "$OUT"

# Exclusions: dev-only files, OS junk, the user's real config.php.
cd "$ROOT"
zip -rq "$OUT" "php-portal" \
  -x "php-portal/config.php" \
  -x "*/.DS_Store" \
  -x "*/.git/*" \
  -x "*/node_modules/*"

SIZE=$(du -h "$OUT" | cut -f1)
echo "Built $OUT ($SIZE)"