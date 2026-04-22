## Rule: Section Core

Section-only constraints. **Output format and App Router-wide styling bans** (no `<style jsx>`, no duplicating `globals.css`, one-file TSX contract) are defined **only** in the **outputTsx** guardrail — this file does not restate them.

### Absolute Prohibitions

- **Never include a navigation bar or footer** inside a section component. These are handled by the layout shell.
- **Never add decorative vertical side labels** (rotated text like "TRENDING_2024" pinned to edges). These conflict with the global layout.

### Structure

- Self-contained component, no props, realistic hardcoded content.
- Each section is a content block composed inside a page alongside other sections.
