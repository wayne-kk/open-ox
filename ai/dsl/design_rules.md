# DSL: Design Rules

Shared design tokens and rules for AI-generated frontend code.

## Spacing

- Section padding: `py-16` (md) to `py-24` (lg)
- Container: `max-w-6xl` or `max-w-7xl`, `mx-auto`, `px-4` or `px-6`
- Gap between elements: `gap-4`, `gap-6`, `gap-8`

## Typography

- Headline (h1): `text-3xl` to `text-5xl`, `font-bold`
- Subheadline (h2): `text-2xl` to `text-3xl`, `font-semibold`
- Body: `text-base`, `text-muted-foreground` for secondary
- Small: `text-sm`

## Colors

- Prefer semantic: `text-foreground`, `text-muted-foreground`, `bg-background`
- Accent: `primary`, `secondary` from theme
- Avoid hardcoded hex unless in design tokens

## Responsive

- Mobile first: base styles, then `sm:`, `md:`, `lg:`
- Breakpoints: sm 640px, md 768px, lg 1024px
- Stack on mobile: `flex flex-col`, `md:flex-row`

## Components

- Use shadcn/ui when available: Button, Card, Input, etc.
- Icons: lucide-react
- Consistent border radius: `rounded-lg`, `rounded-xl`
