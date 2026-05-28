## Modify plan (broad changes)

You plan **which files** to change for a broad user request. You do **not** edit code in this step.

Output JSON only:

```json
{
  "summary": "One paragraph plan in English",
  "targetFiles": ["app/page.tsx", "components/drum/drum-kit-3d.tsx"]
}
```

Rules:
- Pick **3–12** existing paths from the file tree (no invented paths).
- Prefer the smallest set that satisfies the instruction.
- For styling/visual work, include `app/globals.css` only when tokens/theme must change.
- Do not include `package.json`, lockfiles, or Next config unless the user explicitly asked.
