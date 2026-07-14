# Omit `# syntax=docker/dockerfile:1` so BuildKit does not pull docker.io/docker/dockerfile
# (often blocked or slow without registry mirror).

# Next.js standalone production image (pnpm).
#
# Build-time NEXT_PUBLIC_* can come from either:
#   (A) `.env.local` copied into the build context (.dockerignore allows it), or
#   (B) `docker compose --env-file .env.local build`, or
#   (C) `docker build --build-arg NEXT_PUBLIC_...=...` (overrides when non-empty).
#
# Cover capture: Playwright Chromium is installed at build time into /ms-playwright;
# the runner installs OS libs + Noto CJK fonts so headless screenshots render Chinese.

FROM node:20-bookworm-slim AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
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
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN if [ -n "${NEXT_PUBLIC_SUPABASE_URL}" ]; then export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"; fi && \
    if [ -n "${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY}" ]; then export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY="${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY}"; fi && \
    if [ -n "${NEXT_PUBLIC_SITE_URL}" ]; then export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL}"; fi && \
    pnpm build && \
    pnpm exec playwright install chromium

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Playwright OS deps + CJK-capable fonts for cover screenshots (tofu without these).
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
  && fc-cache -f \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Runtime `fs` reads under ai/flows/generate_project/prompts/skills (design-system catalog); not always traced into standalone alone.
COPY --from=builder --chown=nextjs:nodejs /app/ai/flows/generate_project/prompts/skills ./ai/flows/generate_project/prompts/skills
COPY --from=builder --chown=nextjs:nodejs /ms-playwright /ms-playwright

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
