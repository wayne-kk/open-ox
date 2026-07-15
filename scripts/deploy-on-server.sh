#!/usr/bin/env bash
# Production deploy on the app host. Invoked by CI over SSH, or manually:
#
#   cd /sharedata/wayne/open-ox && bash scripts/deploy-on-server.sh
#
# Expects (from server-setup.sh):
#   - docker + compose installed, daemon running (Hub mirror recommended)
#   - current user can `docker info` (member of group docker)
#   - compose.prod.yaml, .env.production, and Docker build context already present
#   - open-ox-runtime image available (local or TCR); auto-builds :local if missing
#
# Optional TCR (Phase B):
#   OPEN_OX_TCR_REPO=ccr.ccs.tencentyun.com/<ns>
#   OPEN_OX_RUNTIME_IMAGE=ccr.ccs.tencentyun.com/<ns>/open-ox-runtime:2026.07
#   OPEN_OX_PUSH_APP_IMAGE=1   # push open-ox:$TAG to TCR after build
set -euo pipefail

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"
export DOCKER_BUILDKIT=1

APP_DIR="${OPEN_OX_APP_DIR:-/sharedata/wayne/open-ox}"
cd "$APP_DIR"

ts() { date -Is; }

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
# Empty string from unset CI secrets must not win over the default.
if [[ -z "${OPEN_OX_RUNTIME_IMAGE:-}" ]]; then
  export OPEN_OX_RUNTIME_IMAGE=open-ox-runtime:local
fi
if [[ -z "${OPEN_OX_PUSH_APP_IMAGE:-}" ]]; then
  export OPEN_OX_PUSH_APP_IMAGE=0
fi

echo "==> Docker: $(docker --version)"
echo "==> deploy start $(ts)"
echo "==> app image: open-ox:${OPEN_OX_IMAGE_TAG}"
echo "==> runtime:   ${OPEN_OX_RUNTIME_IMAGE}"

# Warn if Hub accelerator missing (FROM node / runtime pulls stay slow).
if ! docker info 2>/dev/null | grep -q 'mirror.ccs.tencentyun.com'; then
  echo "WARN: Docker Hub mirror mirror.ccs.tencentyun.com not in docker info."
  echo "      Run: sudo OPEN_OX_DEPLOY_USER=$(id -un) bash scripts/server-setup.sh"
fi

# Ensure runtime base exists (cold path once; daily deploys should hit cache / TCR).
if ! docker image inspect "${OPEN_OX_RUNTIME_IMAGE}" >/dev/null 2>&1; then
  if [[ "${OPEN_OX_RUNTIME_IMAGE}" == ccr.ccs.tencentyun.com/* ]] \
    || [[ "${OPEN_OX_RUNTIME_IMAGE}" == *.tencentcloudcr.com/* ]]; then
    echo "==> pulling runtime $(ts)"
    docker pull "${OPEN_OX_RUNTIME_IMAGE}"
  else
    echo "==> runtime missing — building via scripts/build-runtime.sh $(ts)"
    bash scripts/build-runtime.sh
  fi
fi

echo "==> compose build start $(ts)"
# Build on the server so we never pull multi-GB images from ghcr.io across the Pacific.
# Do not pass --no-cache on daily deploys (destroys layer cache).
docker compose -f compose.prod.yaml --env-file .env.production build
echo "==> compose build end $(ts)"

# Optional: push app image to TCR for rollback / future pull-only deploys.
if [[ "${OPEN_OX_PUSH_APP_IMAGE:-0}" == "1" ]]; then
  REPO="${OPEN_OX_TCR_REPO:-}"
  if [[ -z "$REPO" ]]; then
    echo "ERROR: OPEN_OX_PUSH_APP_IMAGE=1 requires OPEN_OX_TCR_REPO"
    exit 1
  fi
  REMOTE="${REPO}/open-ox:${OPEN_OX_IMAGE_TAG}"
  echo "==> push app image ${REMOTE} $(ts)"
  docker tag "open-ox:${OPEN_OX_IMAGE_TAG}" "${REMOTE}"
  docker push "${REMOTE}"
  echo "==> push end $(ts)"
fi

echo "==> Stopping legacy PM2 processes (if any)"
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete open-ox 2>/dev/null || true
  pm2 delete open-ox-generation-worker 2>/dev/null || true
  pm2 save 2>/dev/null || true
fi

echo "==> Starting containers $(ts)"
docker compose -f compose.prod.yaml --env-file .env.production up -d --remove-orphans --no-build

echo "==> Status"
docker compose -f compose.prod.yaml --env-file .env.production ps
echo "==> deploy end $(ts)"
echo "==> Deploy complete"
