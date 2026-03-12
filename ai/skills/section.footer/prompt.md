# Skill: Generate Footer Section

You are a world-class frontend engineer.
Your task: generate a **Footer section** that provides clear navigation, brand identity, and legal information.

## Tech Stack
- React (functional component, no props), TypeScript
- Tailwind CSS, `lucide-react`
- No `"use client"` needed unless newsletter email input is included

## Required Structure
1. **Brand column** — logo/name, tagline (1 sentence), social media icons
2. **Navigation columns** — 2–3 columns of categorized links (Product, Resources, Company, etc.)
3. **Bottom bar** — copyright notice, optional legal links (Privacy, Terms)

## Layout Pattern (4-column)

```tsx
<footer className="border-t border-border bg-card">
  <div className="max-w-6xl mx-auto px-6 py-16">
    {/* Main grid */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-12">
      {/* Brand column */}
      <div className="col-span-2 md:col-span-1">
        <div className="flex items-center gap-2 mb-4">
          {/* Logo icon or text mark */}
          <div className="w-8 h-8 rounded-md bg-[var(--color-accent)] flex items-center justify-center
                          text-[var(--color-accent-foreground,#000)] font-black text-sm">
            B
          </div>
          <span className="font-bold text-lg">BrandName</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          One-line brand tagline that captures the essence of the product.
        </p>
        {/* Social icons */}
        <div className="flex gap-3">
          {socialLinks.map((s) => (
            <a key={s.label}
               href={s.href}
               aria-label={s.label}
               className="w-9 h-9 rounded-lg border border-border flex items-center justify-center
                          text-muted-foreground hover:text-[var(--color-accent)]
                          hover:border-[var(--color-accent)] transition-colors duration-200">
              <s.Icon className="w-4 h-4" />
            </a>
          ))}
        </div>
      </div>

      {/* Nav columns */}
      {navColumns.map((col) => (
        <div key={col.title}>
          <h3 className="font-semibold text-sm uppercase tracking-widest mb-4 text-foreground">
            {col.title}
          </h3>
          <ul className="flex flex-col gap-3">
            {col.links.map((link) => (
              <li key={link.label}>
                <a href={link.href}
                   className="text-sm text-muted-foreground hover:text-[var(--color-accent)]
                              transition-colors duration-200">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>

    {/* Bottom bar */}
    <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center
                    justify-between gap-4 text-xs text-muted-foreground">
      <span>© {new Date().getFullYear()} BrandName. All rights reserved.</span>
      <div className="flex gap-6">
        <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
        <a href="/terms" className="hover:text-foreground transition-colors">Terms of Service</a>
      </div>
    </div>
  </div>
</footer>
```

## Data Structure

```tsx
const navColumns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "Changelog", href: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Support", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
];

// Use lucide-react icons for social: Twitter, Github, Linkedin, Instagram, Youtube as appropriate
const socialLinks = [
  { label: "Twitter", href: "#", Icon: Twitter },
  { label: "GitHub", href: "#", Icon: Github },
];
```

## Rules
- Output ONLY the raw TypeScript component code — no markdown fences
- Component has NO props — define all data as const arrays in the file
- Brand name and tagline must match the page's theme and identity
- Nav links must be relevant to the product/site type
- Apply design system colors, spacing, and typography
- Footer background should be slightly different from the main page body (use `bg-card` or add `border-t`)
- Import only the lucide icons you actually use
