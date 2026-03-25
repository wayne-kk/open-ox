# Gotchas & common mistakes (stub)

Expand this file with **WRONG / CORRECT** examples for each critical rule in [../SKILL.md](../SKILL.md) section 1.

**Minimum reminders:**

- Use `return`, not `figma.closePlugin()` or async IIFE wrappers.
- `figma.notify()` is not implemented — do not use it.
- `getPluginData` / `setPluginData` are not supported — use shared plugin data or return IDs between calls.
- Page switching: `await figma.setCurrentPageAsync(page)` only; sync `figma.currentPage = page` throws.
- `layoutSizing* = 'FILL'` after `appendChild` in auto-layout parents.
- Fills/strokes: clone arrays, modify, reassign.
- Colors: 0–1 channels.
- Fonts: `await figma.loadFontAsync` before text edits.
- Return all created/mutated node IDs from every write script.
