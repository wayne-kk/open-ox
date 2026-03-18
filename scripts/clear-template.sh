#!/usr/bin/env bash
# Clear generated content in sites/template.
# Only removes files that the generate_project flow overwrites.
# Keeps: package.json, tsconfig, next.config, etc.

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="$ROOT/sites/template"

echo "Clearing sites/template generated content..."
echo ""

# 1. Section components
if [[ -d "$SITE/components/sections" ]]; then
  find "$SITE/components/sections" -maxdepth 1 -type f \( -name "*.tsx" -o -name "*.ts" \) -print0 | while IFS= read -r -d '' f; do
    rm "$f"
    echo "  rm components/sections/$(basename "$f")"
  done
fi

# 2. Single files
for rel in app/page.tsx app/layout.tsx app/globals.css design-system.md; do
  if [[ -f "$SITE/$rel" ]]; then
    rm "$SITE/$rel"
    echo "  rm $rel"
  fi
done

# 3. app/[slug]/page.tsx (non-home pages)
if [[ -d "$SITE/app" ]]; then
  for dir in "$SITE/app"/*/; do
    [[ -d "$dir" ]] || continue
    name=$(basename "$dir")
    [[ "$name" == "api" ]] && continue
    if [[ -f "$dir/page.tsx" ]]; then
      rm "$dir/page.tsx"
      echo "  rm app/$name/page.tsx"
    fi
    if [[ -z "$(ls -A "$dir" 2>/dev/null)" ]]; then
      rmdir "$dir"
      echo "  rmdir app/$name"
    fi
  done
fi

echo ""
echo "Done."
