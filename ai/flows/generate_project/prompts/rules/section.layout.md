## Rule: Section Layout

Every section must follow a consistent two-layer structure and separation rules.

### 1. Two-Layer Structure

#### Outer Layer
- Use `w-full`
- Only for: background color / background image / gradient / background texture
- Forbidden: rounded corners, border, shadow, ring
- Forbidden: extra padding or margin

#### Inner Container
- Default: `container mx-auto px-8 py-20`
- Hero or high-impact sections: `py-24`
- Forbidden: nested width-limiting containers
- Forbidden: any `max-w-*`

Correct pattern: Outer `w-full` for background only; inner `container mx-auto px-8 py-20` (or `py-24` for hero) for content.

### 2. Section Separation

Do not use separators between sections:
- No `border-b` / `border-t`
- No `divide-y` / `divide-x`
- No `<hr />`
- No 1px divider lines
- No pseudo-element line dividers
- No shadow as section boundary

Use vertical spacing (e.g. `py-20`, `py-24`) and background contrast to create natural section breaks.
