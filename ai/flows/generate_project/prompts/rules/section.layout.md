## Rule: Section Layout

### Two-Layer Structure

- **Outer**: `w-full` — only for background color/image/gradient. No rounded corners, border, shadow.
- **Inner**: `container mx-auto px-8 py-20` (or `py-24` for hero). No nested `max-w-*`.

### Section Separation

No visual separators between sections:
- No `border-b`, `divide-y`, `<hr />`, pseudo-element lines, or shadow boundaries.
- Use vertical spacing and background contrast for natural breaks.
