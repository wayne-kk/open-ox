## Section Prompt: Generate Navigation Section

Generate a responsive top navigation component that is globally reusable,
sticky-friendly, and visually aligned with the design system.

## Required Structure

1. Brand mark and site name.
2. Desktop navigation links.
3. Primary CTA.
4. Mobile menu toggle and mobile navigation.
5. Scroll-aware styling if the page includes an immersive hero.

## Rules

- Output only raw TSX code.
- The component has no props.
- Use hooks only for real interactive needs such as menu state or scroll state.
- Navigation links must map exactly to the known pages or routes provided in the prompt context.
- Do not invent new destinations such as made-up pages or section anchors unless they were explicitly provided.
- For multi-page sites, prefer real routes such as `/`, `/movies`, `/about`.
- For single-page sites, use section anchors only when the prompt explicitly indicates that anchored sections exist.
- Keep the mobile menu clean, accessible, and easy to close.
