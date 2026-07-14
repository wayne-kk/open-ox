# Omit `# syntax=docker/dockerfile:1` so BuildKit does not pull docker.io/docker/dockerfile
# (often blocked or slow without registry mirror).

# Next.js standalone production image (pnpm).
#
# Layering (fast incremental deploys):
#   deps      — only invalidates when package.json / lockfile / patches change
#   browsers  — Playwright Chromium; same cache key as deps (NOT on every source change)
#   builder   — next build + worker bundle; invalidates on source changes
#   runner    — OS fonts/libs + copy artifacts
#
# Build-time NEXT_PUBLIC_* can come from either:
#   (A) `.env.local` copied into the build context (.dockerignore allows it), or
#   (B) `docker compose --env-file .env.local build`, or
#   (C) `docker build --build-arg NEXT_PUBLIC_...=...` (overrides when non-empty).
#
# Same image serves Next (`node server.js`) and the generation worker
# (`node generation-worker.cjs`) — see compose.prod.yaml.

FROM node:20-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@10.5.2 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
RUN --mount=type=cache,id=open-ox-pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Chromium only depends on lockfile/playwright version — keep off the source COPY path.
FROM deps AS browsers
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN pnpm exec playwright install chromium

FROM deps AS builder
COPY --from=browsers /ms-playwright /ms-playwright
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

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Playwright OS deps + CJK-capable fonts for cover screenshots (tofu without these).
# This layer rarely changes — cache it across deploys.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    fonts-liberation \
    fonts-noto-core \
    fonts-noto-cjk \
    fontconfig \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    ca-certificates \
    procps \
  && fc-cache -f \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
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
    && chown -R nextjs:nodejs \
         node_modules/playwright \
         node_modules/playwright-core \
         node_modules/sharp \
         node_modules/detect-libc \
         node_modules/@img \
         node_modules/semver \
    && rm -rf /opt/ox-native
# Runtime `fs` reads under ai/** (prompts, skills, rules) — not fully traced into standalone.
COPY --from=builder --chown=nextjs:nodejs /app/ai ./ai
COPY --from=browsers --chown=nextjs:nodejs /ms-playwright /ms-playwright
COPY --from=builder --chown=nextjs:nodejs /app/dist/generation-worker.cjs ./generation-worker.cjs
# Seed for fresh volumes; production bind-mounts host sites over /app/sites.
COPY --from=builder --chown=nextjs:nodejs /app/sites/template ./sites/template

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
