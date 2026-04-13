## Rule: Section Typography

Use semantic font roles from the design system. Apply them strictly by content type.

In TSX, use Tailwind font utilities generated from `@theme` tokens in `app/globals.css`: `font-display`, `font-header`, `font-body`, `font-label`.

### Font Hierarchy (className)

- **`font-display`** — Hero wordmarks, mastheads, one-off high-impact display text. Use sparingly.
- **`font-header`** — Semantic headings (`h1`, `h2`, `h3`) and subheadings.
- **`font-body`** — Paragraph copy, longer reading text, descriptions.
- **`font-label`** — Labels, eyebrow text, badges, metadata, controls, small decorative UI text.

### Rules

- Do not swap roles (e.g. do not use `font-display` for body copy).
- Do not define local `@font-face` or override font families in the component.
- Use the font utility classes defined in this project’s `app/globals.css`; do not invent parallel class names.
