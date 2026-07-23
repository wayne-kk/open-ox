---
name: generate-project-images
description: Generate real visual assets with Open-OX's Ark image pipeline while implementing or polishing websites and apps. Use when frontend work needs hero art, photography, illustrations, backgrounds, textures, editorial imagery, product scenes, or when temporary image placeholders should be replaced with project-ready files.
---

# Generate Project Images

Treat imagery as part of the implementation, not a deferred placeholder task.

## Decide whether to generate

Generate an image when the interface needs photographic, illustrative, atmospheric, editorial, or textured content and no suitable user or repository asset already exists.

Do not generate:

- logos, icons, simple geometry, gradients, or decoration better expressed in CSS or SVG
- screenshots or fake product UI that should be implemented as real components
- images containing essential text, labels, trademarks, or readable interface copy
- replacements for suitable assets already supplied by the user or repository

Prefer a deliberate CSS treatment over decorative filler. Each generated image must have a clear role in the composition.

## Workflow

1. Inspect the existing asset folders and the component that will consume the image.
2. Determine the required subject, composition, aspect ratio, focal area, palette, and responsive crop behavior.
3. Choose a descriptive kebab-case filename tied to the image's role, such as `hero-coffee-roastery`.
4. Write a dense English prompt of at most 160 characters. Specify subject, composition, medium or style, lighting, palette, and finish. Exclude text, letters, logos, watermarks, and UI.
5. From the Open-OX repository root, run:

   ```bash
   pnpm image:generate --project-root <absolute-project-root> --filename <name> --prompt '<prompt>'
   ```

6. Use the returned public path directly in the implementation. Do not guess or reconstruct it.
7. Inspect the generated file before considering the UI complete. Confirm that its subject, crop, contrast, and focal point work in the actual component.
8. Generate a revised image when the visual does not fit. Do not compensate for a poor image with excessive overlays.

Use `--dry-run` first when validating a command or target without calling Ark. Use `--force` only when intentionally replacing an existing image; otherwise choose a new filename.

## Prompt constraints

- Keep the prompt at or below 160 characters; the pipeline truncates longer prompts.
- Describe composition explicitly, especially subject placement and negative space needed for overlaid content.
- Keep text and brands out of generated pixels.
- Avoid vague quality-only prompts such as "beautiful premium image".
- Maintain a coherent art direction across images on the same page.

Example:

```text
Ceramic coffee cup on dark walnut bar, subject right, warm window light, deep brown and cream palette, editorial photo, no text, sharp focus
```

## Failure handling

If `ARK_API_KEY` is unavailable or generation fails, report that clearly and continue implementation with a stable local layout treatment. Do not silently introduce random remote images. Leave the intended filename and prompt ready for a later retry.

Never commit secrets or print the API key. Generated assets may be committed when that matches the repository's existing asset policy.
