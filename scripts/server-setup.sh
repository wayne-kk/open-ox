#!/usr/bin/env bash
# Run ONCE on the Tencent / 火山引擎 host (with sudo), then never from CI.
#
#   sudo OPEN_OX_DEPLOY_USER=ubuntu bash scripts/server-setup.sh
#
# Prepares a PM2 host (no Docker required for daily deploys):
#   - Node 20 + corepack/pnpm
#   - pm2 (global)
#   - Playwright OS deps + CJK fonts
#   - APP_DIR ownership for the deploy user
set -euo pipefail

APP_DIR="${OPEN_OX_APP_DIR:-/sharedata/wayne/open-ox}"
DEPLOY_USER="${OPEN_OX_DEPLOY_USER:-ubuntu}"
DEBIAN_MIRROR="${DEBIAN_MIRROR:-mirrors.cloud.tencent.com}"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run as root, e.g. sudo OPEN_OX_DEPLOY_USER=ubuntu bash $0"
  exit 1
fi

echo "==> App dir: $APP_DIR"
echo "==> Deploy user: $DEPLOY_USER"

# ── apt mirrors (Tencent) ────────────────────────────────────────────────────
if [[ -f /etc/apt/sources.list ]]; then
  sed -i \
    -e "s|deb.debian.org|${DEBIAN_MIRROR}|g" \
    -e "s|security.debian.org|${DEBIAN_MIRROR}|g" \
    -e "s|archive.ubuntu.com|${DEBIAN_MIRROR}|g" \
    -e "s|security.ubuntu.com|${DEBIAN_MIRROR}|g" \
    /etc/apt/sources.list || true
fi
if ls /etc/apt/sources.list.d/*.list >/dev/null 2>&1; then
  sed -i \
    -e "s|archive.ubuntu.com|${DEBIAN_MIRROR}|g" \
    -e "s|security.ubuntu.com|${DEBIAN_MIRROR}|g" \
    /etc/apt/sources.list.d/*.list || true
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y

# Fonts + common Chromium runtime libs (Playwright install-deps covers the rest).
apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  git \
  fonts-noto-cjk \
  fonts-noto-color-emoji \
  fonts-liberation \
  libnss3 \
  libnspr4 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libpango-1.0-0 \
  libcairo2 \
  xvfb \
  build-essential \
  python3

# ── Node 20 ──────────────────────────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1 || ! node -v | grep -qE '^v20\.'; then
  echo "==> Installing Node.js 20.x..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "==> Node: $(node -v)"

# ── pnpm via corepack ────────────────────────────────────────────────────────
corepack enable
corepack prepare pnpm@10.5.2 --activate
echo "==> pnpm: $(pnpm -v)"

# ── pm2 ──────────────────────────────────────────────────────────────────────
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi
echo "==> pm2: $(pm2 -v | head -1)"

# Start pm2 on boot for deploy user (print instructions; operator confirms once).
if id "$DEPLOY_USER" >/dev/null 2>&1; then
  echo "==> Configure pm2 startup as $DEPLOY_USER (run once after first deploy):"
  echo "    sudo -u $DEPLOY_USER bash -lc 'cd $APP_DIR && pm2 start ecosystem.config.cjs && pm2 save && pm2 startup'"
fi

mkdir -p "$APP_DIR/sites/template" "$APP_DIR/logs" "$APP_DIR/.playwright/browsers" "$APP_DIR/.open-ox"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
chmod -R u+rwX,go+rX "$APP_DIR/sites"
chmod -R a+rwX "$APP_DIR/sites"

# Best-effort: install Playwright OS deps using the app's playwright version when tree exists.
if [[ -f "$APP_DIR/package.json" ]]; then
  echo "==> playwright install-deps (best-effort)..."
  sudo -u "$DEPLOY_USER" bash -lc "cd '$APP_DIR' && (corepack enable; corepack prepare pnpm@10.5.2 --activate; pnpm install --frozen-lockfile || true) && (pnpm exec playwright install-deps chromium || true)"
fi

echo ""
echo "==> Server ready for PM2 deploys."
echo "    node: $(command -v node) ($(node -v))"
echo "    pnpm: $(command -v pnpm) ($(pnpm -v))"
echo "    pm2:  $(command -v pm2)"
echo ""
echo "If old Docker data still eats disk:"
echo "  sudo bash $APP_DIR/scripts/server-cleanup-docker.sh"
echo ""
echo "First deploy:"
echo "  sudo -u $DEPLOY_USER bash -lc 'cd $APP_DIR && bash scripts/deploy-on-server.sh'"
echo ""
echo "Daily: push to main — CI rsync + deploy-on-server.sh (install skipped when lockfile unchanged)."
echo ""
echo "Optional: prune idle local sites workspaces (mtime > 1 day; never deletes template)."
echo "  Dry-run:  bash $APP_DIR/scripts/cleanup-idle-sites.sh"
echo "  Cron e.g.  0 4 * * * cd $APP_DIR && bash scripts/cleanup-idle-sites.sh --execute >> logs/cleanup-idle-sites.log 2>&1"
