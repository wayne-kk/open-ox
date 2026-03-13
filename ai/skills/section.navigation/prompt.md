# Skill: Generate Navigation Section

You are a world-class frontend engineer.
Your task: generate a **top navigation bar** component that is sticky, responsive, and visually consistent with the design system.

## Tech Stack
- Always add `"use client"` as the FIRST line of the file — required for all section components in Next.js App Router

- React (functional component, no props), TypeScript
- Tailwind CSS, `lucide-react`
- `"use client"` + `useState` + `useEffect` for mobile menu and scroll state

## Required Structure

1. **Brand mark** — logo icon or text mark + site name
2. **Desktop nav links** — 4–6 links, horizontally arranged, hidden on mobile
3. **CTA button** — primary action (e.g., "Get Started", "Buy Tickets"), visible on desktop; moved into mobile menu on small screens
4. **Mobile hamburger** — toggle button visible on mobile (`md:hidden`), opens a full-width dropdown or slide-in menu
5. **Scroll behavior** — transparent when at top of page, transitions to solid/blur background when scrolled

## Core Implementation

```tsx
"use client";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
  { label: "About", href: "#about" },
];

export default function NavigationSection() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300
        ${
          scrolled
            ? "bg-background/90 backdrop-blur-md border-b border-border shadow-sm"
            : "bg-transparent"
        }`}
    >
      <nav className="container mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <a
          href="#"
          className="flex items-center gap-2 font-bold text-lg shrink-0"
        >
          <div
            className="w-8 h-8 rounded-md bg-accent flex items-center justify-center
                          text-accent-foreground font-black text-sm"
          >
            B
          </div>
          <span>BrandName</span>
        </a>

        {/* Desktop links */}
        <ul className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                className="text-sm font-medium text-muted-foreground
                            hover:text-accent transition-colors duration-200"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-4">
          <a
            href="#login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Log in
          </a>
          <a
            href="#signup"
            className="px-5 py-2 rounded-lg bg-accent text-accent-foreground
                        text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Get Started
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile dropdown menu */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out
          bg-background/95 backdrop-blur-md border-b border-border
          ${menuOpen ? "max-h-screen opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div className="container mx-auto px-6 py-4 flex flex-col gap-1">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="py-3 px-4 rounded-lg text-sm font-medium text-muted-foreground
                          hover:bg-muted hover:text-foreground transition-colors duration-150"
            >
              {link.label}
            </a>
          ))}
          <div className="mt-3 pt-3 border-t border-border flex flex-col gap-2">
            <a
              href="#login"
              className="py-3 px-4 rounded-lg text-sm font-medium text-center
                          border border-border hover:border-accent
                          hover:text-accent transition-colors duration-200"
            >
              Log in
            </a>
            <a
              href="#signup"
              className="py-3 px-4 rounded-lg text-sm font-semibold text-center
                          bg-accent text-accent-foreground
                          hover:opacity-90 transition-opacity"
            >
              Get Started
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
```

## Scroll Behavior Variants

**A. Transparent → Frosted Glass (default, works on hero with dark/image background):**

```tsx
// Already shown above — uses backdrop-blur-md + bg-background/90 when scrolled
```

**B. Always Solid (for pages without a full-bleed hero):**

```tsx
<header className="sticky top-0 z-50 bg-background border-b border-border">
```

**C. Colored Top Bar with Design System Accent:**

```tsx
// Before the main nav, add a 1-line announcement bar:
<div
  className="w-full py-2 text-center text-xs font-semibold
                bg-accent text-accent-foreground"
>
  🎃 Limited time offer — Use code HALLOWEEN for 20% off
</div>
```

## Active Link Highlighting (scroll spy — optional, only if design system is interactive/dynamic)

```tsx
// Simple hash-based active state — no external library needed:
const [activeHash, setActiveHash] = useState("");

useEffect(() => {
  const onHashChange = () => setActiveHash(window.location.hash);
  window.addEventListener("hashchange", onHashChange);
  setActiveHash(window.location.hash);
  return () => window.removeEventListener("hashchange", onHashChange);
}, []);

// In link className:
`${activeHash === link.href ? "text-accent" : "text-muted-foreground"}`;
```

## Design System Integration Points

| Element                    | CSS Variable to use                  |
| -------------------------- | ------------------------------------ |
| Brand accent color         | `var(--color-accent)`                |
| Nav link hover             | `var(--color-accent)`                |
| Mobile menu background     | `var(--background)` or `var(--card)` |
| Scrolled backdrop          | `bg-background/90 backdrop-blur-md`  |
| Active indicator underline | `border-b-2 border-accent`           |
| Announcement bar           | `var(--color-accent)` background     |

## Rules

- Output ONLY the raw TypeScript component code — no markdown fences, no explanations
- Component has NO props: `export default function NavigationSection() {`
- Always use `"use client"` — scroll + menu state require hooks
- Nav links must anchor to actual section IDs used in the page (match the blueprint's section `fileName` slugs or `#features`, `#pricing`, etc.)
- Brand name, CTA copy, and link labels must match the page's theme and content
- Mobile menu must close when a link is clicked (`onClick={() => setMenuOpen(false)}`)
- The `<header>` uses `fixed` positioning — the **Hero section must add `pt-16` or `pt-20`** to avoid content hiding under the navbar; include a JSX comment noting this
- Import only the lucide icons actually used (`Menu`, `X` at minimum)
- **ALWAYS** output `"use client"` as the very first line — every section component must be a Client Component
