#!/usr/bin/env bash
# One-shot: wipe legacy Docker stacks/images/volumes on the open-ox host.
# Does NOT delete /sharedata/wayne/open-ox/sites (user projects).
#
#   sudo bash scripts/server-cleanup-docker.sh
set -euo pipefail

APP_DIR="${OPEN_OX_APP_DIR:-/sharedata/wayne/open-ox}"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run as root, e.g. sudo bash $0"
  exit 1
fi

echo "==> disk before"
df -h /
docker system df 2>/dev/null || echo "(docker not installed or not running)"

echo "==> stop compose / known containers (best-effort)"
if command -v docker >/dev/null 2>&1; then
  if [[ -f "$APP_DIR/compose.prod.yaml" ]]; then
    (cd "$APP_DIR" && docker compose -f compose.prod.yaml --env-file .env.production down -v --remove-orphans) 2>/dev/null || true
  fi
  if [[ -f "$APP_DIR/compose.yaml" ]]; then
    (cd "$APP_DIR" && docker compose -f compose.yaml down -v --remove-orphans) 2>/dev/null || true
  fi
  docker rm -f open-ox open-ox-generation-worker 2>/dev/null || true
  # Remove open-ox related images
  docker images --format '{{.Repository}}:{{.Tag}} {{.ID}}' | awk '/open-ox|ox-sites|ox-native/ {print $2}' | xargs -r docker rmi -f 2>/dev/null || true
  echo "==> prune ALL unused docker data (images/containers/networks/build cache/volumes)"
  docker system prune -af --volumes
  docker builder prune -af 2>/dev/null || true
fi

echo "==> optional: remove leftover /opt bake paths from old images"
rm -rf /opt/ox-sites-template /opt/ox-native 2>/dev/null || true

echo "==> disk after"
df -h /
docker system df 2>/dev/null || true

echo ""
echo "==> Done. User sites left intact under: $APP_DIR/sites"
echo "    To fully uninstall Docker Engine as well:"
echo "      apt-get purge -y docker-ce docker-ce-cli containerd.io docker-compose-plugin docker-compose-v2 || true"
echo "      rm -rf /var/lib/docker /var/lib/containerd"
echo "      apt-get autoremove -y"
echo "    Then run: sudo OPEN_OX_DEPLOY_USER=ubuntu bash $APP_DIR/scripts/server-setup.sh"
