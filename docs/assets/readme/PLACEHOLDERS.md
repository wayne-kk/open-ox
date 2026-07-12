# README media placeholders

Drop assets into this folder, then remove the `> **Media placeholder:** …` callouts in `README.md` / `README.zh-CN.md` once the file exists.

| File | Suggested content | Spec |
|------|-------------------|------|
| `banner.png` or `banner.webp` | Brand lockup / wordmark on atmospheric background | ~1920×640, dark-friendly |
| `logo-light.svg` / `logo-dark.svg` | Optional wordmark for GitHub `#gh-light-mode-only` / `#gh-dark-mode-only` | SVG |
| `hero.png` or `hero.webp` | Studio: generation pipeline + live preview | 16:9, ≥1600px wide |
| `hero-light.webp` / `hero-dark.webp` | Optional light/dark product shot (`<picture>` or gh-mode suffix) | 16:9, ≥1600px |
| `demo.gif` | Short loop if you skip video hosting | ≤8MB if possible |
| `demo.mp4` or host on YouTube/Bilibili | 30–60s: prompt → generate → preview → Design Mode → Deploy | 16:9, H.264 |
| `pipeline.png` or `pipeline.svg` | 8-node engineering pipeline diagram | SVG preferred |
| `design-mode.png` | Click-to-edit Design Mode (source-coordinate apply) | 16:9 |
| `community.png` | Community grid + Remix lineage | 16:9 |
| `deploy.png` | BYO Vercel Deploy success / Integrations | 16:9 |
| `architecture.svg` | System architecture (Studio → flows → Supabase → preview/deploy) | SVG |

## Markdown patterns (copy when ready)

**Image**

```md
<p align="center">
  <img src="docs/assets/readme/hero.png" alt="Open-OX Studio" width="900" />
</p>
```

**Local video** (GitHub renders inconsistently; prefer YouTube/Bilibili link + poster)

```md
<p align="center">
  <a href="https://www.youtube.com/watch?v=YOUR_ID">
    <img src="docs/assets/readme/hero.png" alt="Watch Open-OX demo" width="900" />
  </a>
</p>

<p align="center">
  <a href="https://www.youtube.com/watch?v=YOUR_ID">▶ Watch demo</a>
  ·
  <a href="https://www.bilibili.com/video/YOUR_BV">Bilibili</a>
</p>
```

**Light / dark (optional)**

```md
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/readme/hero-dark.png" />
    <img src="docs/assets/readme/hero-light.png" alt="Open-OX Studio" width="900" />
  </picture>
</p>
```
