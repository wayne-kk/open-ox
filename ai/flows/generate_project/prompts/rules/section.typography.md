## Rule: Section Typography

Use semantic font roles from the design system. Apply them strictly by content type.

In TSX, use Tailwind font utilities generated from `@theme` tokens in `app/globals.css`: `font-display`, `font-header`, `font-body`.

### Font Hierarchy (className)

- `**font-display**` — Hero wordmarks, mastheads, one-off high-impact display text. Use sparingly.
- `**font-header**` — Semantic headings (`h1`, `h2`, `h3`) and subheadings.
- `**font-body**` — Paragraph copy, longer reading text, descriptions.
- **Label/Eyebrow/Metadata** — use `font-body` with weight/size/tracking utilities (e.g. `text-xs font-medium tracking-wide`).

### Logo / press / “as featured” rows

- Primary names and metrics must stay readable: prefer `text-foreground/90`–`text-foreground` on light surfaces, or `text-background/90` on `bg-foreground`.
- Do not stack **whole-row** low opacity with **caption-level** gray (e.g. `opacity-60` + `text-foreground/40` + `grayscale`) — use a **banded container** (`rounded-2xl border border-border/50 bg-secondary/20 px-8 py-6`) or remove the grayscale filter.

### Rules

- Do not swap roles (e.g. do not use `font-display` for body copy).
- Do not define local `@font-face` or override font families in the component.
- Use the font utility classes defined in this project’s `app/globals.css`; do not invent parallel class names.
- Do not insert manual line breaks in headings/body (`<br />`, forced `\n`) just to shape layout.
- Avoid premature wrapping on desktop: do not constrain headline containers with overly narrow widths (e.g. `max-w-md`/`max-w-lg`) when the grid column still has free space.
- In split/two-column heroes, headline wrapper should generally use the available text column width (or a soft measure like ~`20-28ch`), not an artificially tight cap.
- Body copy measure should stay readable: target roughly `45-75` characters per line on desktop; avoid both ultra-short and overly long lines.
- Prefer balanced wrapping for large headlines (e.g. `text-wrap: balance`) when supported, but never rely on forced hard breaks.
- Keep heading length readable:
  - Hero H1: target <= 24 Chinese chars (or <= 12 English words), max 2 lines.
  - Section H2: target <= 18 Chinese chars (or <= 10 English words), max 2 lines.
  - Body paragraph: prefer 1-3 short sentences per block; avoid long-wall copy in one `<p>`.