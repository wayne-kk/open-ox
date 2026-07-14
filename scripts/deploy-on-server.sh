#!/usr/bin/env bash
# Production deploy on the app host. Invoked by CI over SSH, or manually:
#
#   cd /sharedata/wayne/open-ox && bash scripts/deploy-on-server.sh
#
# Expects (from server-setup.sh):
#   - docker + compose installed, daemon running
#   - current user can `docker info` (member of group docker)
#   - compose.prod.yaml, .env.production, and Docker build context already present
set -euo pipefail

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

APP_DIR="${OPEN_OX_APP_DIR:-/sharedata/wayne/open-ox}"
cd "$APP_DIR"

if [[ ! -f compose.prod.yaml ]]; then
  echo "ERROR: missing $APP_DIR/compose.prod.yaml (CI should rsync it)"
  exit 1
fi
if [[ ! -f .env.production ]]; then
  echo "ERROR: missing $APP_DIR/.env.production (CI should generate + rsync it)"
  exit 1
fi
if [[ ! -f Dockerfile ]]; then
  echo "ERROR: missing $APP_DIR/Dockerfile — deploy needs the build context on the server"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not installed. On the server run once:"
  echo "  sudo OPEN_OX_DEPLOY_USER=$(id -un) bash scripts/server-setup.sh"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: cannot talk to Docker daemon."
  echo "  sudo systemctl start docker"
  echo "  # if permission denied: ensure you are in group docker, then re-login"
  echo "  groups; sudo usermod -aG docker $(id -un)"
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: docker compose unavailable. Re-run server-setup.sh"
  exit 1
fi

# Image tag for local builds (set by CI). Default keeps a stable name.
export OPEN_OX_IMAGE_TAG="${OPEN_OX_IMAGE_TAG:-local}"

echo "==> Docker: $(docker --version)"
echo "==> Building image open-ox:${OPEN_OX_IMAGE_TAG} (layer cache lives on this host)"
# Build on the server so we never pull multi-GB images from ghcr.io across the Pacific.
docker compose -f compose.prod.yaml --env-file .env.production build

echo "==> Stopping legacy PM2 processes (if any)"
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete open-ox 2>/dev/null || true
  pm2 delete open-ox-generation-worker 2>/dev/null || true
  pm2 save 2>/dev/null || true
fi

echo "==> Starting containers"
docker compose -f compose.prod.yaml --env-file .env.production up -d --remove-orphans --no-build

echo "==> Status"
docker compose -f compose.prod.yaml --env-file .env.production ps
echo "==> Deploy complete"
