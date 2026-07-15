#!/usr/bin/env bash
# Remove idle local project workspaces under sites/ (host bind-mount).
#
# Idle = no non-artifact file/dir under sites/{projectId}/ has mtime newer than
# MAX_AGE_DAYS (excludes node_modules, .next, out). Source of truth is Supabase
# Storage; next open restores via ensureProjectSourcesOnDisk.
#
# Never deletes sites/template. Skips projects with sites/{id}/.next/lock.
# Default is dry-run; pass --execute to delete.
#
# Production (host cron example — do not auto-install):
#   0 4 * * * cd /sharedata/wayne/open-ox && bash scripts/cleanup-idle-sites.sh --execute >> logs/cleanup-idle-sites.log 2>&1
#
# Usage:
#   bash scripts/cleanup-idle-sites.sh [--sites-dir DIR] [--max-age-days N] [--execute]
#
set -euo pipefail

SITES_DIR="${SITES_DIR:-/sharedata/wayne/open-ox/sites}"
MAX_AGE_DAYS="${MAX_AGE_DAYS:-1}"
EXECUTE=0

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sites-dir)
      SITES_DIR="${2:?--sites-dir requires a path}"
      shift 2
      ;;
    --max-age-days)
      MAX_AGE_DAYS="${2:?--max-age-days requires a number}"
      shift 2
      ;;
    --execute)
      EXECUTE=1
      shift
      ;;
    -h|--help)
      usage 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage 1
      ;;
  esac
done

if ! [[ "$MAX_AGE_DAYS" =~ ^[1-9][0-9]*$ ]]; then
  echo "ERROR: --max-age-days must be a positive integer (got: $MAX_AGE_DAYS)" >&2
  exit 1
fi

if [[ ! -d "$SITES_DIR" ]]; then
  echo "ERROR: sites dir not found: $SITES_DIR" >&2
  exit 1
fi

SITES_DIR="$(cd "$SITES_DIR" && pwd)"
cutoff=$(($(date +%s) - MAX_AGE_DAYS * 86400))
mode="dry-run"
[[ "$EXECUTE" -eq 1 ]] && mode="execute"

echo "==> cleanup-idle-sites  mode=$mode  sites=$SITES_DIR  max_age_days=$MAX_AGE_DAYS  cutoff=$(date -u -d "@$cutoff" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -r "$cutoff" +%Y-%m-%dT%H:%M:%SZ)"

# True if any path under $1 (excluding build artifacts) is newer than $cutoff.
is_recently_active() {
  local dir="$1"
  # GNU find (production Linux). -quit stops at first hit.
  find "$dir" \
    \( -name node_modules -o -name .next -o -name out \) -prune -o \
    \( -type f -o -type d \) -newermt "@${cutoff}" -print -quit \
    2>/dev/null | grep -q .
}

deleted=0
skipped_lock=0
skipped_fresh=0
skipped_template=0
total_kb=0

shopt -s nullglob
for entry in "$SITES_DIR"/*; do
  [[ -d "$entry" ]] || continue
  name="$(basename "$entry")"

  if [[ "$name" == "template" ]]; then
    skipped_template=$((skipped_template + 1))
    continue
  fi

  if [[ -e "$entry/.next/lock" ]]; then
    echo "  skip (build lock): $name"
    skipped_lock=$((skipped_lock + 1))
    continue
  fi

  if is_recently_active "$entry"; then
    skipped_fresh=$((skipped_fresh + 1))
    continue
  fi

  size_kb="$(du -sk "$entry" 2>/dev/null | awk '{print $1}')"
  size_kb="${size_kb:-0}"
  total_kb=$((total_kb + size_kb))

  if [[ "$EXECUTE" -eq 1 ]]; then
    echo "  rm -rf $name  (${size_kb}K)"
    rm -rf "$entry"
    deleted=$((deleted + 1))
  else
    echo "  would rm -rf $name  (${size_kb}K)"
    deleted=$((deleted + 1))
  fi
done

echo "==> done  candidates=$deleted  skipped_fresh=$skipped_fresh  skipped_lock=$skipped_lock  skipped_template=$skipped_template  ~${total_kb}K"
if [[ "$EXECUTE" -eq 0 ]]; then
  echo "==> dry-run only; re-run with --execute to delete"
fi
