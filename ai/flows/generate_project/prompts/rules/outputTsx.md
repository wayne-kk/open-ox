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

- You MAY use `<style jsx global>` for CSS that is difficult to express in Tailwind (e.g. custom pseudo-elements, keyframe animations, complex selectors).
- **Any component that uses `<style jsx>` or `<style jsx global>` MUST have `"use client";` as the very first line.** styled-jsx does not work in Server Components.
- Prefer Tailwind utility classes for standard layout and spacing. Reserve `style jsx` for effects that genuinely require it.
