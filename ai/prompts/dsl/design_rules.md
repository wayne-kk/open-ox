## Design Rules

### Typography
- Headings: Use semantic hierarchy (h1, h2, h3)
- Body: text-base or text-sm, line-height relaxed
- Muted text: text-muted-foreground or text-gray-500

### Spacing
- Section padding: py-16 to py-24
- Container: max-w-6xl or max-w-7xl, mx-auto, px-4 sm:px-6
- Gaps: gap-4, gap-6, gap-8 for grids

### Colors
- Prefer design tokens (--primary, --muted, etc.) over hardcoded hex
- Use Tailwind semantic classes: bg-background, text-foreground

### Responsive
- Mobile-first: Base styles for mobile, sm/md/lg for larger
- Breakpoints: sm:640, md:768, lg:1024, xl:1280

### Accessibility
- Semantic HTML (main, section, article, nav)
- ARIA labels when needed
- Focus states for interactive elements
