#!/usr/bin/env bash
# Build (and optionally push) the rarely-changing open-ox-runtime image.
#
#   bash scripts/build-runtime.sh
#   OPEN_OX_RUNTIME_TAG=2026.07 bash scripts/build-runtime.sh --push
#
# Env:
#   OPEN_OX_RUNTIME_TAG   default: local (or YYYY.MM if --push without tag)
#   OPEN_OX_TCR_REPO      e.g. ccr.ccs.tencentyun.com/<namespace>
#                         required for --push; also tags/pushes $REPO/open-ox-runtime:$TAG
#   PLAYWRIGHT_VERSION    override (default read from package.json)
set -euo pipefail

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"
export DOCKER_BUILDKIT=1

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PUSH=0
for arg in "$@"; do
  case "$arg" in
    --push) PUSH=1 ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
  esac
done

PW_VER="${PLAYWRIGHT_VERSION:-}"
if [[ -z "$PW_VER" ]]; then
  PW_VER="$(node -p "require('./package.json').dependencies.playwright" 2>/dev/null || true)"
fi
if [[ -z "$PW_VER" || "$PW_VER" == "undefined" ]]; then
  PW_VER="1.52.0"
fi

TAG="${OPEN_OX_RUNTIME_TAG:-}"
if [[ -z "$TAG" ]]; then
  if [[ "$PUSH" -eq 1 ]]; then
    TAG="$(date +%Y.%m)"
  else
    TAG="local"
  fi
fi

LOCAL_IMAGE="open-ox-runtime:${TAG}"
echo "==> build-runtime start $(date -Is)"
echo "==> PLAYWRIGHT_VERSION=${PW_VER}"
echo "==> tagging ${LOCAL_IMAGE}"

docker build \
  -f Dockerfile.runtime \
  --build-arg "PLAYWRIGHT_VERSION=${PW_VER}" \
  -t "${LOCAL_IMAGE}" \
  .

# Convenience alias used by compose default RUNTIME_IMAGE=open-ox-runtime:local
if [[ "$TAG" != "local" ]]; then
  docker tag "${LOCAL_IMAGE}" open-ox-runtime:local
  echo "==> also tagged open-ox-runtime:local"
fi

if [[ "$PUSH" -eq 1 ]]; then
  REPO="${OPEN_OX_TCR_REPO:-}"
  if [[ -z "$REPO" ]]; then
    echo "ERROR: --push requires OPEN_OX_TCR_REPO=ccr.ccs.tencentyun.com/<namespace>"
    exit 1
  fi
  REMOTE="${REPO}/open-ox-runtime:${TAG}"
  echo "==> docker tag → ${REMOTE}"
  docker tag "${LOCAL_IMAGE}" "${REMOTE}"
  echo "==> docker push ${REMOTE}"
  docker push "${REMOTE}"
  echo "==> pushed ${REMOTE}"
fi

echo "==> build-runtime end $(date -Is)"
echo "==> done: ${LOCAL_IMAGE}"
