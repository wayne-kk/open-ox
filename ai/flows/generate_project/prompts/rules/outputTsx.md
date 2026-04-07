## Rule: Output TSX

When the task requires React or Next.js component code, output TSX only.

### Format

- No markdown code fences.
- No explanation before or after the code.
- Return complete, runnable TypeScript/TSX.
- Include all necessary imports.
- Follow project conventions and design-system constraints.
- Output **exactly one** component file. Do not repeat, duplicate, or output the component a second time under any circumstances.
- The file must contain exactly one `export default` statement.
- Do not add any content after the final closing `}` of the component.
- If the component uses any browser API, event handlers, or hooks (`useState`, `useEffect`, etc.), it **MUST** have `"use client";` as the very first line.

### TypeScript Strict Mode

- The project uses `strict: true`. All code must compile without errors under strict mode.
- Never use non-null assertions (`!`). Use null checks with early returns instead.
- All refs (`useRef`) return `T | null` — always check before accessing properties.
- `canvas.getContext("2d")` returns `CanvasRenderingContext2D | null` — always null-check.
