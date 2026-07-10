# Cover capture: CJK fonts + Studio feedback

## Problem Statement

Workspace and Community project cards show cover screenshots where Chinese (and much of the Latin UI text) renders as empty “tofu” boxes, while digits often still appear. The dashboard chrome itself shows Chinese correctly, so the failure is isolated to the cover-capture pipeline (headless Chromium), not the product UI.

Separately, updating a cover from Studio feels unresponsive: the API accepts the job immediately, shows a vague “1–3 minutes / check the list” hint, silently drops a second click while a job is in flight, and after a successful recapture the list can still show the old image because the storage object path is fixed and responses may be cached or redirected to signed URLs.

## Solution

Ship production cover capture that has system CJK-capable fonts and a Playwright Chromium that can run as the non-root app user, wait for fonts to be ready (with a short fail-open timeout) before screenshotting, and give Studio owners clear in-progress / success / failure feedback—including when a capture is already running. Workspace and Community cards load covers through a stable app URL with a version query so a new capture is visible without stale cache.

## User Stories

1. As a project owner, I want cover screenshots of Chinese landing pages to show real glyphs, so that Workspace cards look like the preview I built.
2. As a Community browser, I want listed project covers to be readable (including Chinese), so that I can judge projects from the gallery.
3. As a project owner, I want digits and Latin UI chrome in covers to remain readable, so that mixed-language heroes do not regress when CJK fonts are added.
4. As an operator deploying the production image, I want the app container to include fonts and Chromium needed for capture, so that covers work without undocumented host packages.
5. As a project owner who clicks “update cover” in Studio, I want to see that capture has started, so that I am not left wondering whether the click worked.
6. As a project owner, I want the Studio control to stay busy until success, failure, or a clear timeout, so that “insensitive” capture has a defined end.
7. As a project owner, I want a success hint when the new cover is ready, so that I know I can rely on Workspace/Community cards.
8. As a project owner, I want a failure hint that includes a short server error, so that I can retry or fix preview/Chromium issues without reading server logs first.
9. As a project owner who clicks update cover while a job is already running, I want an explicit in-flight response (not a fake new queue), so that I understand the system did not start a second job.
10. As a project owner who gets an in-flight response, I still want Studio to wait for that job’s outcome, so that I am not stuck with only a toast and no completion signal.
11. As a project owner, I want auto capture after generate/modify and manual Studio capture to share the same in-flight rules, so that rapid “generate finished → update cover” does not double-run.
12. As a project owner, I want a stale “pending” cover state older than the freshness window to be retriable, so that a crashed capture does not permanently lock updates.
13. As a project owner, I want Studio completion to require a newer cover timestamp than the baseline returned when I clicked, so that an already-ready cover is not mistaken for a finished recapture.
14. As a project owner viewing Workspace, I want card images to refresh after a new capture without a hard-coded “please hard-refresh” ritual, so that feedback matches what the list shows.
15. As a Community visitor, I want the same versioned cover URL behavior, so that republished covers do not keep showing the old screenshot.
16. As a developer, I want cover responses to serve image bytes (not redirect to signed storage URLs) for list displays, so that cache busting via query params actually applies to the bytes the browser paints.
17. As a maintainer, I want the obsolete cover-proxy env flag removed, so that “always proxy covers” is not re-broken by forgetting to set it.
18. As a developer, I want cover and reference-page Playwright launches to share sandbox/executable options, so that Docker non-root capture does not fail only on one of the two paths.
19. As a developer, I want pure unit tests around queue/in-flight and cover URL helpers, so that feedback and cache-bust regress without requiring CI Chromium screenshots.
20. As an operator, I do not want deploy to automatically recapture every historical tofu cover, so that rollout stays safe and cheap; owners can recapture manually when needed.

## Implementation Decisions

- Treat garbled covers as an environment + settle problem: add Noto (`fonts-noto-core` + `fonts-noto-cjk`) and install Playwright Chromium into the production image; do not change generated site font stacks in this effort.
- Install browsers during the Docker build stage into a fixed shared path (`PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`), copy into the runner, install OS libs + fonts on the runner, `chown` for the `nextjs` user; do not download Chromium at container start.
- Extract a shared Chromium launch helper used by cover capture and external reference capture: respect `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` when set; when the process is non-root, add `--no-sandbox` / `--disable-setuid-sandbox` (and only the minimal related args needed).
- After `load`, wait for `document.fonts.ready` with a ~5s fail-open timeout, then settle ~300–500ms (replace the fixed 1.2s blind sleep as the primary wait), then screenshot the home viewport as today.
- Keep cinematic polish and fixed cover storage relative path; no new storage object naming scheme.
- Cover capture orchestration returns an explicit result for manual scheduling: `queued` or `in_flight`, always including `baselineUpdatedAt` (cover’s `cover_image_updated_at` at decision time, which may be null).
- In-flight detection: process-local in-flight set **or** DB `cover_image_status = pending` with `cover_image_updated_at` within **3 minutes**. Expired pending allows a new run.
- Auto post-generation/post-modify capture and manual Studio capture share that gate; auto path skips silently when in flight; manual path maps `in_flight` → HTTP **409** `COVER_CAPTURE_IN_FLIGHT`.
- Manual `POST` cover-capture stays async (**202** when queued); response body includes result code + `baselineUpdatedAt`.
- Studio polls project metadata every **2s** for up to **3 minutes**. Success: `ready` and `coverImageUpdatedAt` strictly newer than baseline. Failure: `failed` (prefer failures with timestamp newer than baseline when applicable) and show truncated `coverImageError`. On timeout: clear busy and hint that work may still finish—check Workspace later.
- Both **202** and **409** enter that same poll loop (409 starts with an “already capturing” hint).
- Workspace and Community cards use `/api/projects/:id/cover?v=<coverImageUpdatedAt>` only; stop attaching signed `coverImageUrl` on list/community APIs for this purpose.
- Cover GET always proxies JPEG bytes (remove redirect-to-signed and remove `OPEN_OX_COVER_PROXY_BYTES`); `Cache-Control: private, max-age=300`.
- List/community payloads must expose `coverImageUpdatedAt` (or equivalent) so the client can build `?v=`.
- No schema migration required if `cover_image_*` columns already exist.
- No automatic bulk recapture of existing tofu covers.

## Testing Decisions

- Prefer one orchestration seam: functions that decide queue vs in-flight, return baseline timestamps, and (where extracted) pure helpers that decide poll continue / success / failure given status + timestamps + baseline. Assert external return shapes and HTTP mapping for manual capture, not Playwright internals.
- Thin second seam: cover display URL builder (and/or list payload fields) ensuring `?v=` and that list paths no longer require signed cover URLs.
- Good tests assert behavior at those seams (status codes, codes like `QUEUED` / `COVER_CAPTURE_IN_FLIGHT`, timestamp comparison rules, freshness window). Do not assert Docker package lists or pixel-diff Chinese glyphs in default CI.
- Prior art: existing cover polish tests and other pure lib tests beside capture; project access tests for cover authorization remain untouched unless list field stripping changes contracts.
- Production font/CJK correctness is verified by operator smoke after image rebuild (manual), not CI OCR.

## Out of Scope

- Bulk or deploy-time recapture of existing covers
- Changing generated template/`next/font` stacks to embed CJK webfonts
- Capturing the Studio iframe’s current route instead of the preview home viewport
- Browser/context reuse or other latency deep-dives beyond fonts.ready + shorter settle
- Waiting for networkidle or above-the-fold images as a hard dependency
- CI jobs that launch Chromium to assert Chinese glyph pixels
- Remix/Publish Preview product rules (except consuming covers on Community cards)

## Further Notes

- Glossary: use Workspace, Community, Publish Preview, Studio as in `CONTEXT.md`. Covers remain owner-gated unless Publish Preview allows static/cover access per existing ADR `0002`.
- Feature slug: `cover-capture-cjk-feedback`
- Grilling decisions locked: fonts+wait (C), Docker fonts only for env (A), settle fonts.ready (A), Studio feedback with polling (B→A), Noto packaging as core+cjk (A), no stock backfill (A), 409 in-flight (B) with fresh pending 3m aligned to poll timeout (C→A), Docker Chromium via Playwright install in build (C→A→B path), fonts.ready fail-open 5s (A), settle 300–500ms (A), poll 2s/3m (A), unified `/cover?v=` + always proxy (A→B), drop proxy env flag (A), show truncated errors (B), shared launch + non-root sandbox (A), same gate for auto/manual (A), completion by newer `updatedAt` with baseline from POST (A→B), 409 also polls (A), unit tests for logic seams (A).
