## Rule: Section Typography

Use semantic font roles from the design system. Apply them strictly by content type.

In TSX, use the **`ds-font-*` utility classes** from `app/globals.css` (they map to `@theme` tokens `--font-display`, `--font-header`, `--font-body`, `--font-label`).

### Font Hierarchy (className)

- **`ds-font-display`** — Hero wordmarks, mastheads, one-off high-impact display text. Use sparingly.
- **`ds-font-header`** — Semantic headings (`h1`, `h2`, `h3`) and subheadings.
- **`ds-font-body`** — Paragraph copy, longer reading text, descriptions.
- **`ds-font-label`** — Labels, eyebrow text, badges, metadata, controls, small decorative UI text.

### Rules

- Do not swap roles (e.g. do not use `ds-font-display` for body copy).
- Do not define local `@font-face` or override font families in the component.
- Use the font utility classes defined in this project’s `app/globals.css`; the design pipeline normally provides `ds-font-*` as above — do not invent parallel class names.
