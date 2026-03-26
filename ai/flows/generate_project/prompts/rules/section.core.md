## Rule: Section Core

- Generate a self-contained section component with no props.
- Use realistic content that matches the page intent.
- Make the section production-ready, responsive, and visually intentional.
- Prefer semantic HTML and maintain strong readability.

### Absolute Prohibitions

- **Never include a navigation bar, header nav, or top nav** inside a section component. Navigation is handled globally by the layout shell.
- **Never include a footer** inside a section component. Footer is handled globally by the layout shell.
- **Never add decorative vertical side labels** (e.g. rotated text like "Seasonal Spotlight // Winter 2024", "TRENDING_DATABASE_2024", or any `[writing-mode:vertical-rl]` / `writing-mode: vertical-rl` text pinned to the left or right edge of the section). These are visual noise that conflict with the global layout.
- Each section is a content block only. Assume it will be composed inside a page alongside other sections, with shared navigation and footer already present.
