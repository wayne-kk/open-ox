# Skill: Landing Layout

Generate a full landing page layout that composes multiple sections.

## Structure

1. **Header**: Logo, nav links, CTA
2. **Hero**: Hero section (use section.hero)
3. **Features**: Feature section (use section.feature)
4. **CTA**: Final call-to-action block
5. **Footer**: Links, copyright, social

## Page-Level Rules

- Single column, full width
- Sections separated by py-16 or py-24
- Consistent max-width container (max-w-6xl or max-w-7xl)
- Sticky or fixed header optional

## Responsive

- Mobile: Stack all, hamburger menu for nav
- Tablet: 2-col feature grid
- Desktop: Full layout as designed

## Placeholders

- `{{sections}}` - Ordered list of section IDs to render
- `{{header_links}}` - Nav items
- `{{footer_links}}` - Footer links
