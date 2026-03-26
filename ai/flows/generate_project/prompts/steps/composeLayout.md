## Step Prompt: Compose Layout

You are updating an existing Next.js `app/layout.tsx` file to inject generated
shared layout section components around page content.

## Responsibilities

- Preserve every existing import, font setup, metadata export, and root layout structure.
- Add new section imports only when they are not already present.
- Inject the shared sections into `<body>` in the requested order and placement.
- Output the full updated `app/layout.tsx`, not a diff.

## Rules

- Output only raw TSX code.
- Do not remove or rewrite unrelated existing logic.
- Keep `<html>` and `<body>` attributes intact unless the current file is invalid.
- Respect the placement instructions provided for each shared section.
- Support multiple shared sections before or after `{children}` when requested.
- **Do not add `overflow-hidden` or `overflow-auto` to `<html>` or `<body>`**. These break `sticky` positioning on child elements like the navigation bar. If scroll containment is needed, apply it to a specific inner wrapper, not the root elements.
