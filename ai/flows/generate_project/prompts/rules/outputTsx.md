## Rule: Output TSX

When the task requires React or Next.js component code, output TSX only.

### Requirements

- No markdown code fences.
- No explanation before or after the code.
- Return complete, runnable TypeScript/TSX.
- Include all necessary imports.
- Follow project conventions and design-system constraints.
- Output **exactly one** component file. Do not repeat, duplicate, or output the component a second time under any circumstances.
- The file must contain exactly one `export default` statement.
- Do not add any content after the final closing `}` of the component.

### Styling Rules

- **NEVER use `<style jsx>` or `<style jsx global>`.** This is strictly forbidden — it causes build errors in Next.js App Router and is redundant because all styles are already defined in `globals.css`.
- **NEVER redefine CSS classes or keyframes that already exist in `globals.css`.** Use Tailwind utility classes generated from `@theme` tokens and built-in Tailwind utilities directly.
- Prefer token-backed Tailwind utilities (`bg-*`, `text-*`, `border-*`, `font-*`, `shadow-*`, `animate-*`) and Tailwind arbitrary values for one-off visual needs (`[clip-path:*]`, `bg-[radial-gradient(...)]`, etc.).
- For keyframe animations not in globals.css, use Tailwind's `animate-[name_duration_easing]` arbitrary value syntax instead of defining new keyframes.
- Prefer Tailwind utility classes for all layout, spacing, color, and typography.
- If the component uses any browser API, event handlers, or hooks (`useState`, `useEffect`, etc.), it **MUST** have `"use client";` as the very first line.
- **NEVER import `client-only` or `server-only`.** These sentinel packages frequently cause App Router build failures in generated files. Use component boundaries instead:
  - Browser interactivity/hooks/events => add `"use client";` as first line.
  - Non-interactive/static rendering => keep as Server Component without sentinel imports.