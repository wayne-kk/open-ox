## Rule: Section Typography

Use semantic font roles from the design system. Apply them strictly by content type.

### Font Hierarchy

- **`font-display`** — Hero wordmarks, mastheads, one-off high-impact display text. Use sparingly.
- **`font-header`** — Semantic headings (`h1`, `h2`, `h3`) and subheadings.
- **`font-body`** — Paragraph copy, longer reading text, descriptions.
- **`font-label`** — Labels, eyebrow text, badges, metadata, controls, small decorative UI text.

### Rules

- Do not swap roles (e.g. do not use `font-display` for body copy).
- Do not define local `@font-face` or override font families in the component.
- Reference the token utilities defined in `app/globals.css` (e.g. `font-display`, `font-header`).
