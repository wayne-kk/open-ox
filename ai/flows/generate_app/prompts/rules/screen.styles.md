## Rule: Screen Styles

- Use Tailwind utility classes for visual styling on every major element.
- Translate design-system tokens into utilities (`bg-*`, `text-*`, `border-*`, `shadow-*`, `font-*`, `animate-*`).
- Keep style language consistent across all regions (same radius scale, border contrast, elevation rhythm).
- Ensure interactive controls have explicit visual states (default, hover/active, focus-visible).
- Do not output bare semantic HTML with no visual treatment.

## Rule: No Visible Scrollbars (critical)

Scrollbars must never be visible anywhere in the app. The global `globals.css` already includes a universal scrollbar reset (`scrollbar-width: none` + `*::-webkit-scrollbar { display: none }`), so scrollbars are hidden by default on every element.

In components, your only responsibility is to ensure scrollable containers use the correct overflow class — the scrollbar will be hidden automatically:

```tsx
// Just use overflow — no extra class needed, global CSS handles hiding
<div className="overflow-y-auto">   {/* ✅ scrollbar hidden by globals.css */}
<div className="overflow-x-auto">   {/* ✅ scrollbar hidden by globals.css */}
```

As a **defensive fallback**, add `style={{ scrollbarWidth: "none" }}` on the primary scrollable wrapper in case globals.css is not yet applied:

```tsx
<div className="overflow-y-auto" style={{ scrollbarWidth: "none" }}>
```

**Never** add `overflow-hidden` to `<html>` or `<body>` — this breaks `fixed`/`sticky` positioning (tab bar, headers).
