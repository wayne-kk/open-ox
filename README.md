<p align="center">
  <!-- MEDIA: docs/assets/readme/banner.png (~1920×640) -->
  <img src="docs/assets/readme/banner.png" alt="Open-OX" width="720" />
</p>

<p align="center">
  <strong>Open-OX</strong><br />
  AI-native website production engine
</p>

<p align="center">
  <em>Think it. Build it. Run it.</em>
</p>

<p align="center">
  From one natural-language brief to a <strong>runnable, verifiable, editable, deployable</strong> Next.js project — not a screenshot, not a sandbox illusion.
</p>

<p align="center">
  <a href="./README.md"><strong>English</strong></a>
  ·
  <a href="./README.zh-CN.md">简体中文</a>
  ·
  <a href="./CONTEXT.md">Glossary</a>
  ·
  <a href="./docs/adr/">ADRs</a>
  ·
  <a href="./docs/product-iteration-outline.md">Roadmap</a>
</p>

---

> **Media placeholder — Hero / Demo**  
> Drop `docs/assets/readme/hero.png` (Studio: pipeline + preview, 16:9 ≥1600px).  
> Optional: YouTube / Bilibili demo — wrap the poster with a link (see `docs/assets/readme/PLACEHOLDERS.md`).

<p align="center">
  <img src="docs/assets/readme/hero.png" alt="Open-OX Studio — generation pipeline and live preview" width="900" />
</p>

<p align="center">
  <!-- Replace YOUR_* when the demo is uploaded -->
  <a href="https://www.youtube.com/watch?v=YOUR_YOUTUBE_ID">▶ Demo (YouTube)</a>
  ·
  <a href="https://www.bilibili.com/video/YOUR_BV">Bilibili</a>
</p>

---

## Why Open-OX

Most AI site builders stop at *looking like* a website. Open-OX ships a **software-engineering production line**: structured intent, design systems, multi-agent implementation, build gates with auto-repair, transparent Studio traces, and a path to **your** production host.

| Typical tools | Open-OX |
|---------------|---------|
| Screenshot / iframe theater | Real Next.js source on disk |
| One-shot generation, then dead end | Conversational Modify + Design Mode writeback |
| Opaque black box | Streamed pipeline nodes, auditable agent traces |
| Platform-locked hosting | Export the repo · **BYO Vercel** Deploy |
| “Good enough” HTML | Install → build → repair until it compiles |

**Ambition:** the default path from brief → shippable Next.js site for individuals and small teams who refuse to re-hire a contractor to “fix the AI draft.”

---

## Capabilities

### 1. Prompt → Project — an engineering pipeline, not one mega-prompt

Generation is decomposed into **fixed nodes with clear I/O**. Failures are localizable; retries are cheap relative to “reroll the whole site.”

1. **Intent Agent** — turns casual language into an executable Brief  
2. **Design intent** — visual direction from copy and reference images  
3. **Planning** — modules constrained by spec, not free-form sprawl  
4. **Design system** — tokens, type, spacing shared across sections  
5. **Architect scaffold** — one architecture pass, then implementable structure  
6. **Page Implement Agents** — tool loops that write real TSX against the system  
7. **Dependency install** — detect and install what the build needs  
8. **Build + auto-repair** — compile gates; targeted repair loops on failure  

> **Media placeholder — Pipeline**  
> `docs/assets/readme/pipeline.svg` (or `.png`) — eight-node diagram.

<p align="center">
  <img src="docs/assets/readme/pipeline.png" alt="Open-OX generation pipeline" width="900" />
</p>

---

### 2. Design systems & visual ammunition

- **Design system first** — consistency by construction, not by luck  
- **30+ style skills** — Swiss Minimal, Neo-Brutalism, Glassmorphism, Cyberpunk, Art Deco, Terminal, Luxury, and more  
- **Hero skill matrix** — WebGL / shaders / particles / scroll morphs when the brief deserves presence  
- **Reference images, two modes**  
  - **Replicate** — layout fidelity  
  - **Extract** — color & atmosphere without mechanical tracing  
  - Deep visual analysis → constraints → implement (less design drift)

---

### 3. Studio — transparent, iterable, precise

- **Full-trace Studio** — topology, logs, and agent steps stream as the site is born  
- **Modify Agent** — natural-language edits with tools (read / search / edit / build), structured diffs, history turns, bounded memory  
- **Design Mode** — click an element in preview; adjust color, type, spacing, radius. Localization via compile-time `file:line:col` (`data-ox-source`); server JSX AST **Direct Apply** with verify. When Direct cannot apply, hand off a Modify draft — human confirms, never a silent second write engine  
- **Brief / outline confirmation** (product direction) — align structure before burning expensive generation tokens  

> **Media placeholder — Design Mode**  
> `docs/assets/readme/design-mode.png`

<p align="center">
  <img src="docs/assets/readme/design-mode.png" alt="Open-OX Design Mode — click to edit" width="900" />
</p>

---

### 4. Preview that you can trust

| Backend | When |
|---------|------|
| **Static export → Storage + `/site-previews` proxy** | Deterministic shareable URLs; default when Storage is configured |
| **Per-site `next dev`** | HMR + Design Mode source instrumentation |
| **E2B sandboxes** | Isolated cloud runtime — create / reconnect / rebuild |

Stable preview is part of the product contract — not an afterthought iframe.

---

### 5. Workspace · Community · Remix

Visibility is intentional — not “every login sees every project.”

- **Workspace** — owner-private projects (folders included); home for create & edit  
- **Publish Preview** — opt-in listing on **Community**; visitors get static preview only — never Studio / source edit rights  
- **Allow Remix** — separate copy license (only while Publish Preview is on). Signed-in users Remix into a **new owned project** from the latest site snapshot (no secrets, no Studio chat), with lineage attribution  
- Closing Publish Preview unlist immediately; existing remixes remain independent  

> **Media placeholder — Community**  
> `docs/assets/readme/community.png`

<p align="center">
  <img src="docs/assets/readme/community.png" alt="Open-OX Community and Remix" width="900" />
</p>

---

### 6. Delivery — export & BYO Deploy

- **Project export** — take the real codebase; continue in your own repo  
- **BYO Vercel Deploy** (ADR-0003)  
  - OAuth Integration into **your** Vercel account & billing  
  - Static `out/` upload via Files + Deployments APIs  
  - First Deploy creates & binds a project; later Deploys reuse it  
  - **Publish Preview ≠ Deploy** — discovery vs production are separate axes  
  - Disconnect clears Open-OX tokens/bindings only — **never** deletes remote Vercel projects  
- **Integrations settings** — connection, team, jump back to Studio  

> **Media placeholder — Deploy**  
> `docs/assets/readme/deploy.png`

<p align="center">
  <img src="docs/assets/readme/deploy.png" alt="Open-OX BYO Vercel Deploy" width="900" />
</p>

---

### 7. Credits

- Usage metered: LLM tokens → USD → **Credits** (generate / modify)  
- Design Mode Direct Apply does **not** spend credits  
- Free tier daily grant + monthly cap; Pro / packs via Stripe (`/pricing`)  
- Transparent metering — no mystery deductions  

---

## Architecture

```text
Browser · Studio UI
   └─ Next.js API (SSE orchestration)
        ├─ AI Flows
        │    ├─ generate_project
        │    └─ modify_project
        ├─ Supabase (registry · RLS · Storage)
        └─ Preview / Deploy
             ├─ /site-previews · local next dev · E2B
             └─ BYO Vercel OAuth → production URL
```

> **Media placeholder — Architecture**  
> `docs/assets/readme/architecture.svg`

<p align="center">
  <img src="docs/assets/readme/architecture.svg" alt="Open-OX architecture" width="900" />
</p>

| Path | Role |
|------|------|
| `ai/flows/generate_project` | End-to-end generation |
| `ai/flows/modify_project` | Tool-loop modification |
| `app/studio` | Studio UI — topology, trace, Design Mode |
| `lib/staticSitePreview.ts` · `lib/previewMode.ts` · `lib/vercel/` | Preview backends & BYO Deploy |
| `sites/` | Per-project workspaces |
| `public/skills/` | Style skill packs |
| `CONTEXT.md` · `docs/adr/` | Glossary & decisions |

---

## Stack

| Layer | Choices |
|-------|---------|
| App | Next.js 16 · React 19 · TypeScript |
| UI | Tailwind CSS v4 · shadcn / Radix · Framer Motion · Three.js |
| Data | Supabase (Postgres + Storage + RLS) |
| Preview | Storage static · local `next dev` · E2B |
| Deploy | Vercel Integration OAuth |
| Models | OpenAI-compatible APIs |
| Observability | Langfuse · Studio SSE traces |
| Billing | Stripe · Credits |

---

## Design bets

1. **Verifiable beats flashy** — if it does not build, preview, and diff cleanly, it is debt.  
2. **Transparent beats black-box** — evaluate Open-OX by reading Studio traces.  
3. **Modification is first-class** — generation ignites; Modify + Design Mode cruise.  
4. **You own the artifact** — export the source; production lives on your Vercel.  
5. **Constraint buys quality** — high-fidelity single-home profile first; multi-page expands when gates hold.

---

## In one line

**Open-OX = Intent × Design System × Multi-agent implement × Build self-heal × Transparent Studio × Community Remix × BYO Deploy.**

Not another “AI writes a website” toy.  
A **repeatable, auditable, shippable** production line for sites.

---

## Local setup

```bash
cp .env.example .env.local
# Fill the Core section (Supabase + OpenAI-compatible API + site URL)
pnpm check:env
pnpm dev
```

Optional features (Feishu / Google / Linux.do / Stripe / Vercel / E2B / Langfuse / Ark) are capability-gated — leave them unset and the matching UI stays off. See `.env.example` for the full matrix. Capability helpers live in `lib/env.ts`.

---

## Docs

- Glossary — [`CONTEXT.md`](./CONTEXT.md)  
- Architecture decisions — [`docs/adr/`](./docs/adr/)  
- Product roadmap — [`docs/product-iteration-outline.md`](./docs/product-iteration-outline.md)  
- PRDs — [`docs/product/`](./docs/product/)  
- README media checklist — [`docs/assets/readme/PLACEHOLDERS.md`](./docs/assets/readme/PLACEHOLDERS.md)  

Issues and PRs welcome. Pipeline behavior changes deserve an ADR or product note — we treat *why* as part of the build.
