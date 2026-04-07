## Rule: Section Core

### Absolute Prohibitions

- **Never include a navigation bar or footer** inside a section component. These are handled by the layout shell.
- **Never add decorative vertical side labels** (rotated text like "TRENDING_2024" pinned to edges). These conflict with the global layout.
- **Never use `<style jsx>` or `<style jsx global>`**. All styles come from `globals.css` and Tailwind utilities.
- **Never redefine CSS classes or keyframes** that already exist in `globals.css`.

### Structure

- Self-contained component, no props, realistic hardcoded content.
- Each section is a content block composed inside a page alongside other sections.
