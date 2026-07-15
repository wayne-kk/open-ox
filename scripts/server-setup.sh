#!/usr/bin/env bash
# Run ONCE on the Tencent / 火山引擎 host (with sudo), then never from CI.
#
#   sudo OPEN_OX_DEPLOY_USER=ubuntu bash scripts/server-setup.sh
#
# Prerequisites for GitHub Actions deploy (SERVER_USER=ubuntu):
#   - Docker Engine + Compose available
#   - docker.service enabled and running
#   - ubuntu ∈ docker group (re-login once after this script)
#   - APP_DIR writable by ubuntu
set -euo pipefail

APP_DIR="${OPEN_OX_APP_DIR:-/sharedata/wayne/open-ox}"
DEPLOY_USER="${OPEN_OX_DEPLOY_USER:-ubuntu}"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run as root, e.g. sudo OPEN_OX_DEPLOY_USER=ubuntu bash $0"
  exit 1
fi

echo "==> App dir: $APP_DIR"
echo "==> Deploy user: $DEPLOY_USER"

# ── Docker Engine ────────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker Engine (get.docker.com)..."
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sh /tmp/get-docker.sh
  rm -f /tmp/get-docker.sh
else
  echo "==> Docker already installed: $(docker --version)"
fi

systemctl enable containerd 2>/dev/null || true
systemctl enable docker
systemctl start containerd 2>/dev/null || true
systemctl start docker

# ── Compose plugin ───────────────────────────────────────────────────────────
# Tencent Ubuntu mirrors often lack the Docker Inc. package name docker-compose-plugin.
if ! docker compose version >/dev/null 2>&1; then
  echo "==> Installing Docker Compose plugin..."
  apt-get update || true
  if ! apt-get install -y docker-compose-plugin 2>/dev/null \
    && ! apt-get install -y docker-compose-v2 2>/dev/null; then
    ARCH="$(uname -m)"
    case "$ARCH" in
      x86_64|amd64) ARCH=x86_64 ;;
      aarch64|arm64) ARCH=aarch64 ;;
    esac
    mkdir -p /usr/local/lib/docker/cli-plugins
    curl -fsSL "https://github.com/docker/compose/releases/download/v2.32.4/docker-compose-linux-${ARCH}" \
      -o /usr/local/lib/docker/cli-plugins/docker-compose
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  fi
fi

docker info >/dev/null
docker compose version

# ── Docker Hub 内网加速（腾讯云 CVM；未配置时 FROM node 会很慢）──────────────
DAEMON_JSON=/etc/docker/daemon.json
MIRROR=https://mirror.ccs.tencentyun.com
need_restart=0
if [[ ! -f "$DAEMON_JSON" ]] || ! grep -q 'mirror.ccs.tencentyun.com' "$DAEMON_JSON" 2>/dev/null; then
  echo "==> Configuring Docker Hub registry-mirrors → ${MIRROR}"
  if [[ -f "$DAEMON_JSON" ]] && command -v python3 >/dev/null 2>&1; then
    python3 - "$DAEMON_JSON" "$MIRROR" <<'PY'
import json, sys
path, mirror = sys.argv[1], sys.argv[2]
try:
    with open(path) as f:
        data = json.load(f)
except Exception:
    data = {}
mirrors = data.get("registry-mirrors") or []
if mirror not in mirrors:
    mirrors = [mirror] + [m for m in mirrors if m != mirror]
data["registry-mirrors"] = mirrors
with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY
  else
    printf '%s\n' "{" "  \"registry-mirrors\": [\"${MIRROR}\"]" "}" >"$DAEMON_JSON"
  fi
  need_restart=1
else
  echo "==> Docker Hub mirror already configured"
fi
if [[ "$need_restart" -eq 1 ]]; then
  systemctl restart docker
  echo "==> docker restarted"
fi
docker info 2>/dev/null | grep -A5 'Registry Mirrors' || echo "WARN: could not print Registry Mirrors"

# ── Deploy user can use docker without sudo ──────────────────────────────────
if id "$DEPLOY_USER" >/dev/null 2>&1; then
  usermod -aG docker "$DEPLOY_USER"
  echo "==> Added $DEPLOY_USER to group 'docker' (they must start a NEW SSH session once)"
else
  echo "WARN: user $DEPLOY_USER not found — skip usermod"
fi

mkdir -p "$APP_DIR/sites/template" "$APP_DIR/logs"

# Deploy user owns the app tree (rsync / edit compose).
# Container runs as root, so bind-mounted sites/ is writable regardless of host uid.
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
chmod -R u+rwX,go+rX "$APP_DIR/sites"
# Keep template refreshable by deploy user + writable by root-in-container.
chmod -R a+rwX "$APP_DIR/sites"

if command -v pm2 >/dev/null 2>&1; then
  echo "==> Removing legacy PM2 apps..."
  # May be owned by deploy user; best-effort
  sudo -u "$DEPLOY_USER" pm2 delete open-ox 2>/dev/null || true
  sudo -u "$DEPLOY_USER" pm2 delete open-ox-generation-worker 2>/dev/null || true
  sudo -u "$DEPLOY_USER" pm2 save 2>/dev/null || true
fi

echo ""
echo "==> Server ready."
echo "    docker:  $(command -v docker) ($(docker --version))"
echo "    compose: $(docker compose version | head -1)"
echo ""
echo "Verify as $DEPLOY_USER in a NEW login:"
echo "  ssh $DEPLOY_USER@<host>"
echo "  groups          # must list 'docker'"
echo "  docker info     # must show Registry Mirrors: mirror.ccs.tencentyun.com"
echo ""
echo "First-time / monthly runtime base (apt + Chromium):"
echo "  cd $APP_DIR && bash scripts/build-runtime.sh"
echo "  # optional TCR: OPEN_OX_TCR_REPO=ccr.ccs.tencentyun.com/<ns> bash scripts/build-runtime.sh --push"
echo ""
echo "Then push to main — CI builds the app image ON THIS HOST (runtime layer reused)."
echo ""
echo "Optional: prune idle local sites workspaces (mtime > 1 day; never deletes template)."
echo "  Dry-run:  bash $APP_DIR/scripts/cleanup-idle-sites.sh"
echo "  Cron e.g.  0 4 * * * cd $APP_DIR && bash scripts/cleanup-idle-sites.sh --execute >> logs/cleanup-idle-sites.log 2>&1"
