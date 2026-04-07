## Rule: Section Typography

Use semantic font roles from the design system. Apply them strictly by content type.

In TSX, use Tailwind's native **`font-*` utility classes** generated from `@theme` tokens (`--font-display`, `--font-header`, `--font-body`, `--font-label`).

### Font Hierarchy (className)

- **`font-display`** — Hero wordmarks, mastheads, one-off high-impact display text. Use sparingly.
- **`font-header`** — Semantic headings (`h1`, `h2`, `h3`) and subheadings.
- **`font-body`** — Paragraph copy, longer reading text, descriptions.
- **`font-label`** — Labels, eyebrow text, badges, metadata, controls, small decorative UI text.

### Rules

- Do not swap roles (e.g. do not use `font-display` for body copy).
- Do not use raw `font-family` in inline styles — always use the Tailwind utility class.
- If the design system defines only 2 font families, map them to the 4 roles by weight/size variation.
- Heading sizes should follow a clear scale (e.g. `text-5xl` > `text-3xl` > `text-xl`).
- Body text should be `text-base` or `text-lg` with comfortable `leading-relaxed` or `leading-7`.
- Label text should be `text-xs` or `text-sm` with `tracking-wide` or `tracking-widest`.
