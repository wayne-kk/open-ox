#!/bin/sh
# Production entrypoint (runs as root): seed template node_modules from the
# image-baked store so bind-mounted /app/sites does not need a runtime pnpm install.
# Per-project provision uses bind-mount / materialize (see ensureProjectNodeModules);
# this only exposes the shared store under sites/template.
set -eu

SITES_DIR="${OPEN_OX_SITES_DIR_IN_CONTAINER:-/app/sites}"
TEMPLATE_DIR="${SITES_DIR}/template"
BAKED_NM="${OX_BAKED_TEMPLATE_NODE_MODULES:-/opt/ox-sites-template/node_modules}"

mkdir -p "$TEMPLATE_DIR"

if [ -d "$BAKED_NM" ] && [ ! -e "$TEMPLATE_DIR/node_modules" ]; then
  ln -sfn "$BAKED_NM" "$TEMPLATE_DIR/node_modules" \
    || echo "[entrypoint] warn: could not symlink $TEMPLATE_DIR/node_modules -> $BAKED_NM" >&2
fi

exec "$@"
