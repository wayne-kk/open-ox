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
- **NEVER redefine CSS classes or keyframes that already exist in `globals.css`.** Do not redeclare `.ds-font-display`, `.ds-font-header`, `.ds-font-body`, `.ds-font-label`, `.shadow-watercolor`, `.rounded-base`, `.animate-float`, `.bg-grain`, or any other utility already in the design system.
- The project's `globals.css` already provides these utilities — use them directly by className:
  - Fonts: `ds-font-display`, `ds-font-header`, `ds-font-body`, `ds-font-label`
  - Shadows: `ds-shadow-ghibli`, `ds-shadow-ghibli-sm`, `ds-shadow-ghibli-lg`
  - Animations: `ds-animate-float`, `ds-animate-watercolor-bleed`
  - Effects: `ds-radius-organic`, `ds-text-glow`, `ds-transition-soft`, `ds-bg-watercolor`
  - Colors: `ds-text-primary`, `ds-bg-primary`, `ds-text-accent`, `ds-bg-card`
- For keyframe animations not in globals.css, use Tailwind's `animate-[name_duration_easing]` arbitrary value syntax instead of defining new keyframes.
- Prefer Tailwind utility classes for all layout, spacing, color, and typography.
- If the component uses any browser API, event handlers, or hooks (`useState`, `useEffect`, etc.), it **MUST** have `"use client";` as the very first line.
- For **marketing / lifestyle / product / hero photos**, call the `generate_image` tool to create the image asset first, then use the returned path in a standard `<img>` tag. **Never** hardcode external placeholder URLs (Unsplash, Picsum, etc.) for these images.
  - Call `generate_image` with a descriptive `prompt` (subject, style, mood, lighting, composition) and a `filename` (kebab-case, e.g. `hero-bg`, `feature-dashboard`).
  - Use `size: "2K"` for hero / full-bleed backgrounds, `"1K"` for normal images.
  - After the tool returns the path (e.g. `/images/hero-bg.png`), use it in your TSX: `<img src="/images/hero-bg.png" alt="..." className="..." />`
  - You may call `generate_image` multiple times if the section needs several images.
  - If the section only needs icons or abstract shapes, use `lucide-react` or CSS — no need to generate images for those.
