## Step Prompt: Plan Project — Whole Page

You convert a `ProjectBlueprint` into a `PlannedProjectBlueprint` for a **whole-page** application.
The page is a single persistent UI shell — users navigate *within* a fixed frame, not scroll through stacked blocks.

### What to produce

1. Keep structure valid JSON.
2. Attach `pageDesignPlan` to each page.
3. Output **exactly 1 section** — it carries the full application UI.

### Single-page rule (critical)

- This pipeline builds one page (`slug: "home"`).
- Do not invent extra pages/routes.

### layoutSections vs page sections (critical)

- Set `site.layoutSections` to **`[]`**. Do **not** output separate global `NavigationSection` / `FooterSection` for the root layout — the single page section below implements the full shell (top bar, side nav, footer area, main surface) in one component.
- The only content section lives in `pages[0].sections` (exactly one entry).

---

### The single section

Output exactly **1 section** in `pages[0].sections`. This section is the entire application interface.

**Naming**: Use the product's actual domain vocabulary, not technical shell names.

| Product | type | fileName |
|---------|------|----------|
| Social platform | `SocialFeed` | `SocialFeedSection` |
| Community forum | `CommunityForum` | `CommunityForumSection` |
| Analytics dashboard | `AnalyticsDashboard` | `AnalyticsDashboardSection` |
| Project management | `ProjectWorkspace` | `ProjectWorkspaceSection` |
| Messaging app | `MessagingInbox` | `MessagingInboxSection` |
| E-commerce marketplace | `ShopBrowser` | `ShopBrowserSection` |
| Admin panel | `AdminPanel` | `AdminPanelSection` |
| Content creator tool | `CreatorStudio` | `CreatorStudioSection` |

Name it what users of the product would recognise.

**`intent`**: Describe the primary user workflow in 1–2 sentences.
- What can the user do here?
- What is the main surface they interact with?
- What is the first action they take?

**`contentHints`**: Describe the layout regions and key UI components. Be specific:
- Which regions exist: top bar / sidebar / main content area / right panel / bottom nav
- What each region contains: nav items, feed cards, stat widgets, filters, etc.
- Key interaction affordances: compose button, search bar, tab switcher, filter panel
- Approximate density: how many nav items, feed items, widgets to render

---

### Planning style

- Think like a product designer, not a marketing strategist.
- No hero manifestos, no testimonial bands, no FAQ sections.
- The goal is a usable, realistic-looking product interface.

### Output constraints

- Return JSON only (no markdown).
- `pages[0].sections.length` must be exactly `1`.
- `site.layoutSections` must be `[]` (empty array).
