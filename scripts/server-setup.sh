#!/usr/bin/env bash
# ── Open-OX Server Setup ──────────────────────────────────────────────────────
# Run ONCE on your 火山引擎 server (as root): bash server-setup.sh
# After this, push to main → GitHub Actions builds the Docker image, pushes to
# GHCR, and runs `docker compose` on this host (no PM2).
# ───────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="/sharedata/wayne/open-ox"

echo "==> Setting up Open-OX Docker deployment environment..."

# 1. Docker
if ! command -v docker &> /dev/null; then
  echo "==> Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker && systemctl start docker
else
  echo "==> Docker: $(docker --version)"
  systemctl enable docker 2>/dev/null || true
  systemctl start docker 2>/dev/null || true
fi

# 2. Docker Compose plugin
if ! docker compose version &> /dev/null; then
  apt-get update && apt-get install -y docker-compose-plugin
fi

# Allow non-root deploy user to run docker (optional: set OPEN_OX_DEPLOY_USER).
if [ -n "${OPEN_OX_DEPLOY_USER:-}" ] && id "$OPEN_OX_DEPLOY_USER" &>/dev/null; then
  usermod -aG docker "$OPEN_OX_DEPLOY_USER"
  echo "==> Added $OPEN_OX_DEPLOY_USER to docker group (re-login required for that user)"
fi

# 3. App directory (compose.prod.yaml + .env.production are synced by CI)
mkdir -p "$APP_DIR/sites"
# Container runs as uid 1001 (nextjs)
chown -R 1001:1001 "$APP_DIR/sites" 2>/dev/null || true

# 4. Stop legacy PM2 if present
if command -v pm2 >/dev/null 2>&1; then
  echo "==> Removing legacy PM2 apps (open-ox / open-ox-generation-worker)..."
  pm2 delete open-ox 2>/dev/null || true
  pm2 delete open-ox-generation-worker 2>/dev/null || true
  pm2 save 2>/dev/null || true
fi

echo ""
echo "==> Setup complete! docker=$(command -v docker) compose=$(docker compose version 2>/dev/null | head -1)"
echo ""
echo "Next steps — configure GitHub repo Secrets:"
echo "  SERVER_HOST / SERVER_USER / SERVER_SSH_KEY / SERVER_PORT"
echo "  NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY / NEXT_PUBLIC_SITE_URL"
echo "  SUPABASE_SERVICE_ROLE_KEY, OPEN_OX_PREVIEW_*, OPENAI_*, ARK_*, FEISHU_*, VERCEL_*, ..."
echo "  GHCR_READ_TOKEN   # PAT with read:packages (required if the GHCR package is private)"
echo ""
echo "If SERVER_USER is not root, either:"
echo "  OPEN_OX_DEPLOY_USER=that-user bash server-setup.sh"
echo "  # or: usermod -aG docker that-user  (then re-login)"
echo ""
echo "Optional: make ghcr.io/wayne-kk/open-ox public so the server can pull without a token."
echo ""
echo "Then re-run the failed GitHub Actions job (or push to main)."
