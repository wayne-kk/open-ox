#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env.local ]]; then
  echo "docker-build-local: missing .env.local (see .env.local.example)." >&2
  exit 1
fi

exec docker compose --env-file .env.local build "$@"
