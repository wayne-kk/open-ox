## Chrome already mounted — page must NOT own global chrome

`app/layout.tsx` already mounts global chrome from **Chrome Scaffold** (Nav / Sidebar / Footer / bottom tabs live in `components/chrome/**`).

Screenshot replicate is the only pass-through exception (page reproduces reference chrome in sections).

### Hard rules for this page agent

1. **Do not** create or edit `components/chrome/**`.
2. **Do not** edit `app/layout.tsx` or `app/globals.css`.
3. **Do not** implement site-wide Navigation, Navbar, Header bar, Sidebar, Footer, bottom tab bars, or app-shell frames inside `app/**/page.tsx` or page section components — the shell is **always** owned by Chrome.
4. Page content starts with the first **section** / main viewport (Hero, feed body, features, …). The shell above/beside/below is already owned by layout.
5. Single-page sites: every main block needs a stable `id` (e.g. `id="features"`) so Chrome polish can fix `#` anchors.
6. Prefer importing **shared contract stubs** under `components/shared/**` when list/detail cards are needed — do not invent a parallel card for the same entity.

Section-local CTAs and in-section links are fine. Global chrome is not.
