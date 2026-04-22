## Step Prompt: Plan Project — Split Sections

You convert a `ProjectBlueprint` into a `PlannedProjectBlueprint` for a **split-sections** page.
The page is a long-scrolling composition of stacked content blocks that users scroll through top-to-bottom.

### What to produce

1. Keep structure valid JSON.
2. Attach `pageDesignPlan` to each page.
3. Sections only need: type, intent, contentHints, fileName.

### Single-page rule (critical)

- This pipeline builds one page (`slug: "home"`).
- Do not invent extra pages/routes.
- Use in-page anchors for navigation.

### layoutSections vs page sections (critical)

- `layoutSections` = only shared shells (navigation/footer/global bars). Do not change them.
- All content sections must stay in `pages[].sections`.

---

### Section count

- **3–5 sections** total (including opening and closing). Fewer, stronger sections beat many sparse ones.
- 3 sections: tight, punchy — single-message campaigns, personal portfolios.
- 4–5 sections: standard for multi-feature products, e-commerce, content-rich sites.

Use these defaults unless user request overrides:
- `DESIGN_VARIANCE = 8`
- `MOTION_INTENSITY = 6`
- `VISUAL_DENSITY = 6`

---

### Section Archetype Palette

Do **not** default to `Hero → Feature → Testimonial → CTA` for every product.
Pick the combination that fits the actual content:

**Opening (first section — always required)**
- `Hero` — full-bleed brand statement with primary CTA
- `ProductHero` — product-first opening: visual + key specs + buy/try action
- `EventHero` — date, venue, headline act, ticket CTA
- `EditorialHero` — magazine-style split: large image + headline + subtext
- `Manifesto` — bold single-statement brand declaration, minimal copy

**Content / Proof**
- `Feature` — product capabilities, 2–4 item grid or split layout
- `BentoGrid` — asymmetric feature showcase, varied card sizes
- `Metrics` — key numbers/stats band (3–5 figures with labels)
- `Timeline` — chronological steps, milestones, or process flow
- `Workflow` — numbered steps showing how a product works
- `Comparison` — side-by-side feature comparison table
- `Integration` — logos/icons of connected tools or partners
- `LogoWall` — client/partner/press logo strip
- `Gallery` — image or video grid (portfolio, lookbook, press)
- `VideoShowcase` — embedded or mock video player with supporting copy
- `CodeShowcase` — syntax-highlighted code sample for developer products
- `MapEmbed` — location/store map with address and hours

**Social Proof**
- `Testimonial` — 1–3 quotes with attribution and avatar
- `CaseStudy` — narrative proof: challenge → solution → outcome
- `ReviewGrid` — star ratings + short review cards
- `PressLogos` — "As seen in" media logo band
- `AwardsBand` — certifications, badges, trust signals

**Conversion / Action**
- `Pricing` — 2–3 tier pricing cards with feature lists
- `CTA` — closing action band
- `Newsletter` — email capture with value proposition
- `WaitlistForm` — early access sign-up with social proof counter
- `ContactForm` — form + contact details split layout
- `Download` — app store badges or file download CTA

**Content / Editorial**
- `ArticleGrid` — blog post card grid (image + title + date + tag)
- `FeaturedPost` — single editorial spotlight with large image
- `CategoryBand` — horizontally scrollable content category pills
- `TagCloud` — topic taxonomy visualization
- `AuthorBio` — writer/creator profile with social links
- `TableOfContents` — anchor-linked document outline

**Commerce**
- `ProductGrid` — catalog cards (image + name + price + add-to-cart)
- `CategoryGrid` — top-level category navigation with images
- `CartSummary` — order summary with line items
- `ProductSpecs` — technical specification table

**Team / About**
- `Team` — people grid with photo, name, role
- `FounderStory` — narrative origin story with image
- `Values` — company principles or culture pillars
- `JobBoard` — open roles list with department filter

---

### Intent and contentHints

- `intent`: what this section **accomplishes** in the page narrative — brand emotion, proof moment, user task, transition.
- `contentHints`: what is **visible and scannable** — name specific evidence units, layout pattern, image treatment. Include motion guidance (`none` / `subtle` / `emphasis`) and spacing density (`compact` / `standard` / `spacious`).

### Rhythm rules

- Vary surface tone: plan at least one high-contrast band (dark or brand-color background).
- Vary layout pattern: avoid 3+ consecutive centered stacks or identical card grids.
- At least one section should be visually bold — full-bleed image, oversized typography, or striking color.
- Each non-opening section must carry ≥ 2 distinct content units (not just headline + button).
- Merge weak standalone sections into adjacent ones.

---

### Planning style

- Implementation-oriented, not verbose strategy language.
- Do NOT include `designPlan` on sections.

### Output constraints

- Return JSON only (no markdown).
- `sections.length` must be between `3` and `4` inclusive.
