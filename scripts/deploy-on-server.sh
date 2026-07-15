#!/usr/bin/env bash
# Production deploy on the app host (PM2). Invoked by CI over SSH, or manually:
#
#   cd /sharedata/wayne/open-ox && bash scripts/deploy-on-server.sh
#
# Fast path (warm machine):
#   1) skip pnpm install when lockfile hash unchanged
#   2) reuse existing node_modules / .next/cache / Playwright browsers
#   3) pnpm build → pm2 reload
#
# One-time host prep:
#   sudo OPEN_OX_DEPLOY_USER=ubuntu bash scripts/server-setup.sh
set -euo pipefail

# CI appleboy SSH is non-interactive: no .bashrc / nvm. Interactive `node -v` can
# succeed while this script still fails — load common Node locations first.
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${HOME}/.local/share/pnpm:${PATH:-}"

load_node_env() {
  # nvm (most common on hand-provisioned CVMs)
  if [[ -z "${NVM_DIR:-}" ]]; then
    if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
      export NVM_DIR="$HOME/.nvm"
    elif [[ -s /usr/local/nvm/nvm.sh ]]; then
      export NVM_DIR=/usr/local/nvm
    fi
  fi
  if [[ -n "${NVM_DIR:-}" && -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck disable=SC1090
    . "$NVM_DIR/nvm.sh"
  fi
  # fnm
  if command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env)"
  elif [[ -x "$HOME/.local/share/fnm/fnm" ]]; then
    eval "$("$HOME/.local/share/fnm/fnm" env)"
  fi
  # volta
  if [[ -d "$HOME/.volta/bin" ]]; then
    export PATH="$HOME/.volta/bin:$PATH"
  fi
  # n / direct installs under ~/.local
  if [[ -d "$HOME/.local/bin" ]]; then
    export PATH="$HOME/.local/bin:$PATH"
  fi
}

load_node_env

APP_DIR="${OPEN_OX_APP_DIR:-/sharedata/wayne/open-ox}"
cd "$APP_DIR"

ts() { date -Is; }
elapsed() {
  local start="$1"
  echo "$(( $(date +%s) - start ))s"
}

if [[ ! -f .env.production ]]; then
  echo "ERROR: missing $APP_DIR/.env.production (CI should generate + rsync it)"
  exit 1
fi
if [[ ! -f ecosystem.config.cjs ]]; then
  echo "ERROR: missing $APP_DIR/ecosystem.config.cjs"
  exit 1
fi
if [[ ! -f package.json ]]; then
  echo "ERROR: missing $APP_DIR/package.json — rsync the app tree first"
  exit 1
fi

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: missing \`$1\`."
    echo "  whoami=$(id -un) HOME=$HOME"
    echo "  PATH=$PATH"
    echo "  (Interactive SSH often has nvm in .bashrc; CI SSH does not.)"
    echo "Fix options:"
    echo "  1) Install system Node so CI can see it:"
    echo "       sudo OPEN_OX_DEPLOY_USER=$(id -un 2>/dev/null || echo ubuntu) bash $APP_DIR/scripts/server-setup.sh"
    echo "  2) Or symlink nvm node into /usr/local/bin:"
    echo "       sudo ln -sfn \"\$(dirname \$(dirname \$(which node)))/bin/node\" /usr/local/bin/node"
    echo "       sudo ln -sfn \"\$(which pnpm)\" /usr/local/bin/pnpm 2>/dev/null || true"
    echo "       sudo ln -sfn \"\$(which pm2)\" /usr/local/bin/pm2 2>/dev/null || true"
    exit 1
  fi
}

need_cmd node
need_cmd pnpm
need_cmd pm2

# Load .env.production into this shell for `next build` (NEXT_PUBLIC_*).
# Does not override variables already set in the environment.
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%$'\r'}"
  [[ -z "$line" || "$line" == \#* ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  key="${key#"${key%%[![:space:]]*}"}"
  key="${key%"${key##*[![:space:]]}"}"
  [[ -z "$key" ]] && continue
  if [[ -n "${!key+x}" ]]; then
    continue
  fi
  if [[ "${val}" == \"*\" && "${val}" == *\" ]]; then
    val="${val:1:${#val}-2}"
  elif [[ "${val}" == \'*\' && "${val}" == *\' ]]; then
    val="${val:1:${#val}-2}"
  fi
  export "${key}=${val}"
done < .env.production

export NODE_ENV=production
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$APP_DIR/.playwright/browsers}"

echo "==> Node: $(node -v)  pnpm: $(pnpm -v)  pm2: $(pm2 -v | head -1)"
echo "==> deploy start $(ts)"
DEPLOY_T0=$(date +%s)

hash_file() {
  local f="$1"
  if [[ -f "$f" ]]; then
    sha256sum "$f" | awk '{print $1}'
  else
    echo "missing"
  fi
}

LOCK_HASH="$(hash_file pnpm-lock.yaml)"
LOCK_STAMP=".open-ox/deploy-lock.sha256"
mkdir -p .open-ox
PREV_LOCK=""
[[ -f "$LOCK_STAMP" ]] && PREV_LOCK="$(cat "$LOCK_STAMP")"

T0=$(date +%s)
if [[ "$LOCK_HASH" != "$PREV_LOCK" ]] || [[ ! -d node_modules ]]; then
  echo "==> pnpm install (lockfile changed or node_modules missing) $(ts)"
  pnpm install --frozen-lockfile
  echo "$LOCK_HASH" >"$LOCK_STAMP"
else
  echo "==> pnpm install skipped (lockfile unchanged) $(ts)"
fi
echo "==> app deps done in $(elapsed "$T0")"

TEMPLATE_DIR="sites/template"
TEMPLATE_LOCK_HASH="$(hash_file "$TEMPLATE_DIR/pnpm-lock.yaml")"
TEMPLATE_STAMP=".open-ox/deploy-template-lock.sha256"
PREV_TEMPLATE=""
[[ -f "$TEMPLATE_STAMP" ]] && PREV_TEMPLATE="$(cat "$TEMPLATE_STAMP")"

T0=$(date +%s)
if [[ -f "$TEMPLATE_DIR/package.json" ]]; then
  if [[ "$TEMPLATE_LOCK_HASH" != "$PREV_TEMPLATE" ]] || [[ ! -d "$TEMPLATE_DIR/node_modules/next" ]]; then
    echo "==> template pnpm install $(ts)"
    (cd "$TEMPLATE_DIR" && pnpm install --frozen-lockfile)
    echo "$TEMPLATE_LOCK_HASH" >"$TEMPLATE_STAMP"
  else
    echo "==> template deps skipped (lockfile unchanged) $(ts)"
  fi
fi
echo "==> template deps done in $(elapsed "$T0")"

BROWSER_MARK=".open-ox/playwright-chromium.ok"
T0=$(date +%s)
if [[ -f "$BROWSER_MARK" ]]; then
  echo "==> playwright browsers skipped (already installed) $(ts)"
else
  echo "==> playwright install chromium → $PLAYWRIGHT_BROWSERS_PATH $(ts)"
  mkdir -p "$PLAYWRIGHT_BROWSERS_PATH"
  pnpm exec playwright install chromium
  touch "$BROWSER_MARK"
fi
echo "==> playwright check done in $(elapsed "$T0")"

T0=$(date +%s)
echo "==> pnpm build start $(ts)"
pnpm build
echo "==> pnpm build end $(ts) ($(elapsed "$T0"))"

T0=$(date +%s)
echo "==> pm2 reload $(ts)"
if pm2 describe open-ox >/dev/null 2>&1; then
  pm2 startOrReload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs --update-env
fi
pm2 save
echo "==> pm2 done in $(elapsed "$T0")"

echo "==> Status"
pm2 ls
echo "==> deploy end $(ts) (total $(elapsed "$DEPLOY_T0"))"
echo "==> Deploy complete"
