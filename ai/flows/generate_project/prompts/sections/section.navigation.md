## Section Prompt: Generate Navigation Section

Generate a responsive top navigation component that is globally reusable,
sticky-friendly, and visually aligned with the design system.

## Required Structure

1. Brand mark and site name.
2. Desktop navigation links.
3. Primary CTA (only if a real conversion target exists in the known routes).
4. Mobile menu toggle and mobile navigation.
5. Scroll-aware styling if the page includes an immersive hero.

## Positioning Rules

- **Always use `sticky top-0 z-50`** on the root nav element. Never use `fixed` or `absolute` positioning.
- `fixed` removes the element from document flow and causes content below to be obscured. `sticky` keeps the nav in flow and avoids layout shifts.
- Do not add any `padding-top` or `margin-top` compensation to sibling elements — `sticky` does not require it.
- Ensure the nav root element has no parent with `overflow: hidden` or `overflow: auto` (those break sticky). The nav should be a direct child of the layout shell.

## Navigation Links — Strict Rules

- **Use ONLY the routes listed under "Known Routes" in the prompt context.** Do not add, invent, or assume any other pages, sections, or destinations.
- If the site has only one page (e.g. only `/`), the nav links must either be empty or use in-page anchors — never fabricate extra pages.
- Do not add links like "About", "Blog", "Contact", "FAQ", "Pricing", "Features", "Docs", "Support", or any other page unless it explicitly appears in the Known Routes list.
- The nav item label should match the page title from Known Routes. The href must be the exact route path provided.
- If a route slug is "home", its path is `/`.

## Other Rules

- Use hooks only for real interactive needs such as menu state or scroll state.
- Keep the mobile menu clean, accessible, and easy to close.
