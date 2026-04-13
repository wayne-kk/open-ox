## Step Prompt: Generate Screen

You are a senior mobile product UI engineer.
Generate a single React component named `AppScreen` for one app page route.

This is the app screen-first path:
- Do not output section-stacked marketing composition.
- Build one coherent mobile screen surface with unified hierarchy and interaction rhythm.
- Think in screen regions (top context, primary stream/workspace, quick actions, compact feedback), not website sections.

## Core Requirements

1. Output a complete TSX component named `AppScreen`.
2. Use mobile-first structure for ~390px viewport baseline.
3. Keep interaction affordances explicit (primary action, quick secondary actions, visible state cues).
4. Maintain design consistency across regions (spacing scale, card style, interaction feedback pattern).
5. Apply substantial Tailwind styling:
   - key containers/cards/controls/text all need explicit classes,
   - avoid near-unstyled native elements,
   - use tokenized utilities from the design system.
5. Avoid website homepage tropes:
   - long brand manifesto blocks,
   - testimonial/pricing/FAQ pacing,
   - hero poster framing that delays core task usage.

## Feed/Discovery Rule

If context indicates discovery/community/feed intent:
- Use stream-centric information architecture.
- Keep one dominant feed surface with compact metadata and quick interactions.
- Two-column card flow is allowed when readability remains strong; otherwise fall back to one column.

## Output Rules

- Output only raw TSX code.
- Keep component self-contained (no props).
- Server component by default unless clear client-only interactivity is required.
- Do not import `client-only` or `server-only`.
- Ensure visual hierarchy is obvious at a glance (headline/body/meta/action levels).
