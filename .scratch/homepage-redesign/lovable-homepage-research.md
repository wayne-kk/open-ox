# Lovable Homepage Structure Research

> **Canonical copy for the repo research index:** [`docs/research/lovable-homepage-app-shell-20260710.md`](../../docs/research/lovable-homepage-app-shell-20260710.md)  
> **Open-OX redesign requirements:** [`PRD.md`](./PRD.md)

**Subject:** [lovable.dev](https://lovable.dev/)  
**Researched:** 2026-07-10  
**Method:** Primary observation of the live site (browser + WebFetch), plus official docs for post-login app shell. Secondary sources used only where noted.

---

## 1. Overall page sections / information architecture

Observed top-to-bottom on [https://lovable.dev/](https://lovable.dev/) (desktop ~1440×900 and mobile ~551×674):

| # | Section | Role | Evidence |
|---|---------|------|----------|
| 0 | Sticky top nav | Brand + marketing IA + auth CTAs | Live DOM: sticky `top-0 z-50` bar with logo, Solutions/Resources/Community/Enterprise/Pricing/Security, Log in, Get started |
| 1 | Hero | Product-as-CTA: headline + prompt composer | H2 “Build something Lovable”; subcopy “Create apps and websites by chatting with AI”; centered chat input with Build / send |
| 2 | Logo social proof | Trust strip | Copy “Teams from top companies build with Lovable” + horizontal SVG logo marquee (Hearst visible; other logos are unlabeled SVGs) |
| 3 | Meet Lovable | 3-step product story with tabbed demo | H2 “Meet Lovable”; three `aria-pressed` step buttons + visual panel |
| 4 | Discover templates | Gallery / start-from-template | H2 + “View all” → `/templates`; 8 template cards |
| 5 | Lovable in numbers | Scale metrics | H2 + three metric labels (values animate on scroll; automation often saw `0M` before animation completed; partial reads showed `50` / `1` / `720`) |
| 6 | Closing CTA | Second prompt composer | H1 “AI App Builder” + H2 “Ready to build?” + prompt placeholder + Build |
| 7 | Footer | Dense sitemap | Columns: Company, Product, Resources, Legal, Community + language (EN) + social |

**Page title / SEO framing:** `AI App Builder | Vibe Code Apps & Websites with AI, Fast` ([lovable.dev](https://lovable.dev/)).

**IA pattern:** Marketing site is a short, conversion-first funnel: *prompt → trust → how it works → examples → scale → prompt again → footer*. There is no long feature-grid or pricing table on the homepage itself; Pricing/Enterprise/Security are nav destinations.

---

## 2. Layout patterns

### Hero

- **Composition:** Centered, dark full-bleed background; large white headline; muted gray subhead; primary interaction is a wide rounded **prompt box** (not a static screenshot-first hero).
- **Prompt chrome (observed):** Chat input; `+` / “Additional actions”; “Enable plan mode”; send (↑); mode label “Build” with chevron; voice recording control appears when input is focused.
- **CTA hierarchy:** Hero prompt is the primary product action; nav “Get started” is secondary auth entry; “Log in” is tertiary.
- **Source:** Live screenshots + a11y tree on [lovable.dev](https://lovable.dev/).

### Nav

- **Desktop:** Horizontal sticky bar — logo left; mid links; Log in + Get started right.
- **Mobile:** Logo + Get started + hamburger (“Toggle navigation menu”) expanding a full “Navigation menu” with same items + Log in / Get started.
- **Scroll treatment:** Sticky bar (`position: sticky; top: 0; z-index: 50`). On scroll, a colorful pink→orange gradient strip appears under the nav (observed in screenshots after scrolling past hero).
- **No homepage sidebar.** Marketing IA is top-nav only.
- **Source:** Live DOM computed styles + screenshots.

### Social proof

- Short centered line + **auto-scrolling logo marquee** with edge fade masks (`mask-image` linear gradient).
- Logos are decorative SVGs without accessible names in DOM (Hearst readable visually).
- **Source:** Live section HTML/CSS on [lovable.dev](https://lovable.dev/).

### Feature / product education (“Meet Lovable”)

- Left: vertical list of three steps as toggle buttons (`aria-pressed`).
  1. **Start with an idea** — describe app/website or drop screenshots/docs  
  2. **Watch it come to life** — real-time prototype  
  3. **Refine and ship** — iterate + one-click deploy  
- Right: large rounded media/demo panel that switches with the selected step.
- **Source:** Live a11y tree + screenshots.

### Templates

- Section header + “View all” link to [https://lovable.dev/templates](https://lovable.dev/templates).
- Card grid (`article` elements): preview image, title, short description. Examples observed: Maison, Inspo Canvas, Personal blog, Fashion blog, Continuum, Lovable slides, Prompt Frame Creative Portfolio, Ecommerce Store Website Template.
- **Source:** Live page + template URLs under `/templates/...`.

### Metrics

- Three columns: projects built / new projects per week / visits per month to Lovable-built projects.
- Numbers appear to count-up on scroll into view (automation often captured pre-animation `0M`).
- **Source:** Live section text on [lovable.dev](https://lovable.dev/).

### Closing CTA

- Reuses the product metaphor: “Ready to build?” + prompt field with rotating placeholder (“Ask Lovable to create a landing page…”, “Ask Lovable to create a blog about…”) + Build.
- **Source:** Live section text.

### Footer

- Five link columns (Company / Product / Resources / Legal / Community), social links (Discord, Reddit, X, YouTube, LinkedIn), language switcher (EN).
- Product column mixes pricing, persona pages (Founders, PMs, Designers, …), use cases (Prototyping, Internal Tools), Changelog, Status.
- **Source:** Live footer headings/list items.

### Cookie / overlays

- Fixed cookie banner (bottom, high z-index ~9500): Privacy Policy, Cookie Policy, Manage preferences, OK.
- **Source:** Live `role="region"` cookie banner.

---

## 3. Navigation / sidebar patterns

### Marketing site (logged out)

| Pattern | Detail | Source |
|---------|--------|--------|
| Top nav mega-ish dropdowns | **Solutions** expands “Who is it for?” persona list with punchy taglines (Founders, Sales, Product managers, Designers, Marketers, Ops, People, Prototyping, Internal tools) | Click observation on [lovable.dev](https://lovable.dev/) |
| Resources dropdown | Blog, Partners, Templates, Guides, Connectors, Academy, Docs + featured announcement card (“Workspace Insights…”) | Click observation |
| Direct links | Community → `/community`; Enterprise → `/enterprise-landing`; Pricing → `/pricing`; Security → `/security` | Live `href`s |
| Mobile | Hamburger drawer mirrors desktop IA | Mobile viewport observation |

**Implication for sidebar products:** Homepage itself does **not** preview an app sidebar. Sidebar patterns live in the authenticated product (docs below).

### Authenticated app shell (docs; not fully visible without login)

Official docs describe a **left sidebar app shell** after login:

**Source:** [Dashboard overview](https://docs.lovable.dev/introduction/dashboard-overview.md)

- Collapsible left sidebar (`Cmd/Ctrl+B`); tooltips when collapsed.
- **Workspace selector** at top (multi-workspace).
- Nav items: Home, Search (`Cmd/Ctrl+K` command palette), Resources, Connectors.
- **Projects section:** All projects (folder tree), Starred, Created by me, Shared with me.
- **Recents** list.
- Bottom: referral / upgrade cards; **user avatar menu** (Profile, Settings, Appearance, Support, Docs, Community, Homepage, Sign out).
- Inbox / notifications next to avatar.
- Dashboard home mirrors marketing: **prompt input front and center** to create a project; `+` menu for Attach / Design / Connectors; Build vs Plan mode.

**Workspace model:** Projects live in workspaces; billing/credits are workspace-scoped ([Workspace docs](https://docs.lovable.dev/features/workspace.md)).

---

## 4. Interaction patterns

| Pattern | Observation | Source |
|---------|-------------|--------|
| Sticky nav | Remains visible; gains gradient accent after scroll | Live CSS + screenshots |
| Prompt-first conversion | Empty send disabled until input; Build/Plan mode toggle; attach/voice affordances | Live a11y tree |
| Tabbed product story | Meet Lovable steps are pressable toggles swapping demo content | `aria-pressed` buttons |
| Logo marquee | Continuous horizontal scroll with fade masks | Live CSS `transform` / `mask-image` |
| Metric animation | Count-up when section enters viewport | Live text transitioning from `0M` |
| Dual prompt CTAs | Hero + bottom “Ready to build?” both use same composer metaphor | Live page |
| Auth CTAs | Log in / Get started buttons; `/dashboard` redirects to login | [lovable.dev/login?redirect=%2Fdashboard](https://lovable.dev/login?redirect=%2Fdashboard) |
| Login page | Centered dark form: Google / GitHub / Apple, OR email Continue; link to create account; SSO note for Business/Enterprise | Live login screenshot |
| Cookie consent | Fixed bottom card | Live page |
| Skip link | “Skip to main content” | Live a11y tree |
| No marketing modal on load | Aside from cookies, homepage does not force a signup modal | Live observation |

**Auth gate for app shell:** Visiting `/dashboard` while logged out → login with `redirect=/dashboard`. Google OAuth goes through `auth.lovable.dev`. **`https://app.lovable.dev` did not load** in this session (browser chrome-error / WebFetch 403) — product appears hosted primarily on `lovable.dev` after auth, not a separate observable public app shell.

---

## 5. What to adapt vs avoid

### Adapt (portable patterns)

1. **Prompt-as-hero** — Put the core product action in the first viewport instead of only a “Learn more” CTA.
2. **Short funnel** — Hero → trust → 3-step how-it-works → examples → scale → repeat CTA. Avoid stuffing every feature on the homepage.
3. **Persona-led Solutions nav** — Role + one-line benefit (“Prototype, don't spec.”) is scannable and conversion-oriented.
4. **Template gallery as proof** — Real project cards beat abstract feature icons.
5. **Sticky minimal nav** with clear Log in vs Get started split.
6. **App shell continuity** — Same prompt metaphor on marketing hero and logged-in dashboard (docs) reduces cognitive jump after signup.
7. **Collapsible sidebar + command palette** for dense product navigation (docs) — strong pattern if open-ox has many projects/workspaces.

### Avoid / be careful

1. **Copying dark-mode-as-default** without brand fit — Lovable’s entire marketing surface is near-black; that is a brand choice, not a universal best practice.
2. **Unlabeled logo marquees** — Pretty but weak a11y; prefer named logos or captions if trust claims matter legally/reputationally.
3. **Metric theater** — Animated “0M → huge number” can feel hollow if numbers aren’t credible for a smaller product; use qualitative proof or honest scale.
4. **Mega-footer density** — Lovable’s footer is a full sitemap; fine at their scale, noisy for a smaller product.
5. **Hamburger-only desktop** — Lovable expands full links at desktop; collapsing everything into a menu on wide screens would hurt discoverability.
6. **Assuming `app.` subdomain** — Their product gate is login-on-same-domain; don’t hardcode a separate app host pattern from Lovable alone.
7. **Feature-dump homepage** — They deliberately keep features off the home scroll; don’t reverse that by adding dashboard-like chrome to marketing.

---

## 6. Post-login app shell (what we could observe without logging in)

| Check | Result | Source |
|-------|--------|--------|
| Homepage logged-out UI | No sidebar; marketing top nav only | [lovable.dev](https://lovable.dev/) |
| `/dashboard` | Redirects to `/login?redirect=%2Fdashboard` | Live navigation |
| Login UI | Standalone centered auth; no app chrome/sidebar | Login page observation |
| `app.lovable.dev` | Unreachable here (error / 403) | Browser + WebFetch |
| Sidebar existence | Confirmed via official docs: left sidebar with workspace switcher, Home/Search/Resources/Connectors, project groups, recents, user menu | [docs.lovable.dev/.../dashboard-overview](https://docs.lovable.dev/introduction/dashboard-overview.md) |

**Conclusion:** Lovable **does** use a sidebar app shell after login, but it is **not previewed** on the public homepage and cannot be inspected visually without authentication. Design inference for sidebar products should lean on the docs structure above, not on the marketing page layout.

---

## Implications for open-ox

Concrete, product-agnostic notes for a redesign brief:

1. **Separate marketing shell from app shell.** Lovable keeps homepage free of sidebar chrome; the sidebar appears only after auth. If open-ox has a dense product sidebar, don’t force that chrome onto the marketing homepage—mirror the *prompt/action* metaphor instead of the *nav* metaphor.

2. **Lead with the primary create action.** If open-ox’s core loop is “describe → generate/build,” put that control in the hero (and optionally again before the footer). Keep Get started / Log in in the nav as auth, not as the only CTA.

3. **Use a 3-beat product story, not a feature matrix.** Adapt Meet Lovable’s idea → live result → refine/ship structure to open-ox’s actual loop (whatever the verbs are).

4. **Show artifacts, not adjectives.** A template/project gallery (or equivalent public examples) is stronger social proof than icon rows—especially for builder tools.

5. **Nav: few top links + persona/use-case dropdown.** Prefer 4–6 top-level items; park role/use-case pages under one dropdown with benefit lines.

6. **If open-ox needs a sidebar:** Prefer Lovable-doc patterns—workspace/org switcher at top, primary destinations, project/list groupings, recents, user menu at bottom, collapse + command palette—over inventing a unique IA without need.

7. **Trust strip: keep short.** One line + a few recognizable logos (named) is enough under the hero; don’t let social proof compete with the primary action.

8. **Auth should feel continuous.** Login as a calm centered page is fine; ensure post-login lands on a dashboard that still features the same primary create control users saw on the homepage.

9. **Do not cargo-cult visual skin.** Dark canvas, gradient logo accents, and count-up millions are Lovable brand signals. Steal structure and interaction hierarchy; invent open-ox’s own visual system.

10. **Mobile:** Keep a strong Get started in the collapsed header; don’t hide the only conversion path behind the hamburger alone (Lovable keeps Get started visible beside the menu).

---

## Sources

| Source | Used for |
|--------|----------|
| [https://lovable.dev/](https://lovable.dev/) | Homepage IA, layout, nav, interactions (primary) |
| [https://lovable.dev/login](https://lovable.dev/login) / dashboard redirect | Auth gate, login layout |
| [https://lovable.dev/community](https://lovable.dev/community) | Community nav destination |
| [https://docs.lovable.dev/introduction/dashboard-overview.md](https://docs.lovable.dev/introduction/dashboard-overview.md) | Post-login sidebar / dashboard shell |
| [https://docs.lovable.dev/features/workspace.md](https://docs.lovable.dev/features/workspace.md) | Workspace model |
| [https://docs.lovable.dev/](https://docs.lovable.dev/) | Product positioning context |
| `https://app.lovable.dev` | Attempted; not observable in this session |

---

*End of research note. Parent agent should merge with open-ox-specific product context.*
