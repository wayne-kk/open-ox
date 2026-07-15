# Omit `# syntax=docker/dockerfile:1` so BuildKit does not pull docker.io/docker/dockerfile
# (often blocked or slow without registry mirror).

# Next.js standalone production image (pnpm).
#
# Layering (fast incremental deploys):
#   base      — FROM open-ox-runtime (apt + Chromium); rebuild only via build-runtime.sh
#   deps      — only invalidates when package.json / lockfile / patches change
#   builder   — next build + worker bundle; invalidates on source changes
#   runner    — copy artifacts onto runtime (no apt / no playwright install)
#
# Build-time NEXT_PUBLIC_* can come from either:
#   (A) `.env.local` copied into the build context (.dockerignore allows it), or
#   (B) `docker compose --env-file .env.local build`, or
#   (C) `docker build --build-arg NEXT_PUBLIC_...=...` (overrides when non-empty).
#
# Same image serves Next (`node server.js`) and the generation worker
# (`node generation-worker.cjs`) — see compose.prod.yaml.
#
# Runtime base (see Dockerfile.runtime / scripts/build-runtime.sh):
#   docker build -f Dockerfile.runtime -t open-ox-runtime:local .
#   # or pull: docker pull ccr.ccs.tencentyun.com/<ns>/open-ox-runtime:<tag>

ARG RUNTIME_IMAGE=open-ox-runtime:local
FROM ${RUNTIME_IMAGE} AS base
# Runtime already has: CN mirrors, pnpm, apt fonts/libs, /ms-playwright Chromium.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
RUN --mount=type=cache,id=open-ox-pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS builder
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY . .

# Strip other env files so `.env.local` (if present) drives `next build`; keep `.env.local`.
RUN rm -f .env .env.development .env.development.local \
  .env.production .env.production.local .env.test .env.test.local 2>/dev/null || true

# Optional build-args. Do not `ENV` empty values: Next.js will not overwrite existing process.env
# from `.env.local`, so empty ENV would block file-based config.
ARG NEXT_PUBLIC_SUPABASE_URL=
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
ARG NEXT_PUBLIC_SITE_URL=

ENV NEXT_TELEMETRY_DISABLED=1
RUN if [ -n "${NEXT_PUBLIC_SUPABASE_URL}" ]; then export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"; fi && \
    if [ -n "${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY}" ]; then export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY="${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY}"; fi && \
    if [ -n "${NEXT_PUBLIC_SITE_URL}" ]; then export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL}"; fi && \
    pnpm build && \
    pnpm exec esbuild scripts/generation-worker.ts \
      --bundle \
      --platform=node \
      --target=node20 \
      --format=cjs \
      --outfile=dist/generation-worker.cjs \
      --alias:@=. \
      --external:playwright \
      --external:playwright-core \
      --external:sharp

# Next standalone + pnpm often copies `playwright` / `sharp` without resolvable siblings
# (`playwright-core`, `detect-libc`, `@img/*`). Materialize them for the runner.
RUN node <<'NODE'
const fs = require("fs");
const path = require("path");

function pkgDir(name, from) {
  return path.dirname(
    require.resolve(`${name}/package.json`, from ? { paths: [from] } : undefined)
  );
}

function copyTree(src, dest) {
  fs.cpSync(src, dest, { recursive: true, dereference: true });
  console.log(`[ox-native] ${path.basename(dest)} ← ${src}`);
}

const out = "/opt/ox-native/node_modules";
fs.mkdirSync(out, { recursive: true });

const playwrightDir = pkgDir("playwright");
copyTree(playwrightDir, path.join(out, "playwright"));
copyTree(pkgDir("playwright-core", playwrightDir), path.join(out, "playwright-core"));

const sharpDir = pkgDir("sharp");
const sharpNest = path.dirname(sharpDir);
for (const ent of fs.readdirSync(sharpNest)) {
  copyTree(path.join(sharpNest, ent), path.join(out, ent));
}
NODE

# Template deps live OUTSIDE /app/sites so the production bind-mount cannot hide them.
# Runtime bind-mounts (or materializes) project node_modules from here — see
# lib/ensureProjectNodeModules.ts — instead of `pnpm install` into the sites mount.
FROM base AS template-deps
WORKDIR /opt/ox-sites-template
COPY sites/template/package.json sites/template/pnpm-lock.yaml sites/template/pnpm-workspace.yaml ./
RUN --mount=type=cache,id=open-ox-template-pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
# Single-tenant VPS: run as root so bind-mounted /app/sites (host-owned) and
# corepack/pnpm caches never hit EACCES. Do not use this pattern on shared hosts.
ENV OX_BAKED_TEMPLATE_NODE_MODULES=/opt/ox-sites-template/node_modules

# apt + Chromium already in RUNTIME_IMAGE — do not reinstall here (keeps daily deploys fast).

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Overlay native modules so cover capture can `require("playwright")` / `sharp` in standalone.
# Remove incomplete traced copies first — they are often broken symlinks under pnpm.
COPY --from=builder /opt/ox-native/node_modules /opt/ox-native/node_modules
RUN rm -rf \
      node_modules/playwright \
      node_modules/playwright-core \
      node_modules/sharp \
      node_modules/detect-libc \
      node_modules/@img \
      node_modules/semver \
    && cp -a /opt/ox-native/node_modules/. ./node_modules/ \
    && rm -rf /opt/ox-native
# Runtime `fs` reads under ai/** (prompts, skills, rules) — not fully traced into standalone.
COPY --from=builder /app/ai ./ai
COPY --from=builder /app/dist/generation-worker.cjs ./generation-worker.cjs
# Seed for fresh volumes; production bind-mounts host sites over /app/sites.
COPY --from=builder /app/sites/template ./sites/template
# Baked template deps — not under /app/sites, so host bind-mount cannot hide them.
COPY --from=template-deps /opt/ox-sites-template /opt/ox-sites-template

COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

USER root
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "server.js"]
