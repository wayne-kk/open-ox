## Chrome deferred — page must NOT own global chrome

`app/layout.tsx` is a **pass-through** shell (`{children}` only). Global Nav / Footer are created **after all pages** by the Chrome Agent.

### Hard rules for this page agent

1. **Do not** create or edit `components/chrome/**`.
2. **Do not** edit `app/layout.tsx` or `app/globals.css`.
3. **Do not** implement site-wide Navigation, Navbar, Header bar, Sidebar, or Footer inside `app/**/page.tsx` or page section components (`components/home/**`, etc.).
4. Page content starts with the first **section** (Hero, features, …). Leave room at the top for chrome that will wrap the page later.
5. Single-page sites: every main block needs a stable `id` (e.g. `id="features"`) so the later Chrome Agent can build `#` anchors.

Section-local CTAs and in-section links are fine. Global chrome is not.
