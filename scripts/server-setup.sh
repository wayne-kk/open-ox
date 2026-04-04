#!/usr/bin/env bash
# ── Open-OX Server Setup ──────────────────────────────────────────────────────
# Run ONCE on your 火山引擎 server: bash server-setup.sh
# ───────────────────────────────────────────────────────────────────────────────
set -e

APP_DIR="/opt/open-ox"

echo "==> Setting up Open-OX deployment environment..."

# 1. Docker
if ! command -v docker &> /dev/null; then
  echo "==> Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker && systemctl start docker
else
  echo "==> Docker: $(docker --version)"
fi

# 2. Docker Compose plugin
if ! docker compose version &> /dev/null; then
  apt-get update && apt-get install -y docker-compose-plugin
fi

# 3. App directory + docker-compose
mkdir -p "$APP_DIR"
cd "$APP_DIR"

cat > docker-compose.yml << 'COMPOSE'
services:
  open-ox:
    image: open-ox:latest
    container_name: open-ox
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env.production
    volumes:
      - open-ox-sites:/app/sites
      - open-ox-logs:/app/logs
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:3000/ || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s

volumes:
  open-ox-sites:
  open-ox-logs:
COMPOSE

echo ""
echo "==> Setup complete!"
echo ""
echo "Next steps — configure GitHub repo Secrets:"
echo "  SERVER_HOST                                  # server IP"
echo "  SERVER_USER                                  # ssh user"
echo "  SERVER_SSH_KEY                               # ssh private key"
echo "  SERVER_PORT                                  # ssh port"
echo "  NEXT_PUBLIC_SUPABASE_URL                     # supabase project url"
echo "  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY # supabase key"
echo "  E2B_API_KEY                                  # e2b api key"
echo "  OPENAI_API_KEY                               # llm api key"
echo "  OPENAI_API_URL                               # llm api url"
echo "  DIFY_API_URL                                 # (optional) dify url"
echo "  DIFY_API_KEY                                 # (optional) dify key"
echo ""
echo "Then push to main → auto deploy."
