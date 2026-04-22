# Screen Skill: Bottom Tab Bar

Use this skill to implement the bottom navigation tab bar inside the `AppScreen` component.
The tab bar is a core shell element — always render it as a `fixed` bottom bar within the screen.

## Positioning & Container

- Position: `fixed bottom-0 left-0 right-0` (or `sticky bottom-0` if the screen uses a flex column layout).
- Z-index: `z-50` to float above scrollable content.
- Width: `w-full`. Do NOT restrict to a max-width wrapper — fill the full viewport width.

## Visual Style

### Background options (pick one based on design system mood)

| Mood | Background |
|---|---|
| Light / minimal | `bg-background/95 backdrop-blur-md border-t border-border` |
| Dark / deep | `bg-card/90 backdrop-blur-md border-t border-border/40` |
| Solid / opaque | `bg-card border-t border-border` |
| Glass / frosted | `bg-background/60 backdrop-blur-xl border-t border-white/10` |

Always apply at least one of:
- A subtle `border-t` in the design system border token.
- Or a `shadow-[0_-1px_0_0_hsl(var(--border))]` hairline to separate bar from content.

Never leave the bar fully transparent or without any visual separation.

## Tab Item Layout

```tsx
<nav className="fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)] bg-background/95 backdrop-blur-md border-t border-border">
  <div className="flex items-stretch h-14">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => setActiveTab(tab.id)}
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-0.5 min-w-0 px-1 py-2 transition-colors",
          activeTab === tab.id
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <tab.Icon className="h-5 w-5 shrink-0" />
        <span className="text-[10px] leading-none font-medium truncate">{tab.label}</span>
      </button>
    ))}
  </div>
</nav>
```

## Tab Item Specs

| Property | Value |
|---|---|
| Bar height | `h-14` (56px) — consistent across all tabs |
| Icon size | `h-5 w-5` (20px) |
| Label size | `text-[10px]` with `leading-none` |
| Label font weight | `font-medium` |
| Touch target | Each item must fill its flex column (`flex-1`); do NOT add fixed widths smaller than 44px |
| Icon-label gap | `gap-0.5` (2px) |

## Active State Patterns

Choose **one** active indicator style — do not mix multiple:

### Option A — Color change only (minimal)
```tsx
activeTab === tab.id ? "text-primary" : "text-muted-foreground"
```

### Option B — Dot indicator above icon
```tsx
<span className={cn(
  "w-1 h-1 rounded-full mb-0.5 transition-opacity",
  activeTab === tab.id ? "bg-primary opacity-100" : "opacity-0"
)} />
```

### Option C — Pill background fill
```tsx
<div className={cn(
  "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-colors",
  activeTab === tab.id ? "bg-primary/10 text-primary" : "text-muted-foreground"
)}>
```

### Option D — Top border highlight
```tsx
<div className={cn(
  "flex flex-1 flex-col items-center justify-center gap-0.5 border-t-2 transition-colors pt-1",
  activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground"
)}>
```

## Center Action Button (elevated FAB in tab bar)

When the app has a primary "create / compose / add" action, place it at the center tab slot as an elevated circular button that **protrudes above the tab bar**. This is a visually distinct call-to-action, not just a taller tab item.

### Critical rule: the button MUST be larger than the bar, not just shifted up

**WRONG** — only moves the button's position without enlarging it, leaving dead whitespace below:
```tsx
// ❌ Do NOT do this — button is same size as other tabs, gap appears below
<button className="relative -top-4 flex flex-col items-center">
  <Plus className="h-5 w-5" />
</button>
```

**CORRECT** — the circular button itself is bigger (56–64px), protruding above the bar:
```tsx
// ✅ Correct pattern
<div className="flex-1 flex justify-center items-center">
  <button
    onClick={() => setActiveTab("create")}
    className="w-14 h-14 -mt-5 rounded-full bg-primary shadow-lg shadow-primary/40 flex items-center justify-center transition-transform active:scale-95"
  >
    <Plus className="h-6 w-6 text-primary-foreground" />
  </button>
</div>
```

### How it works

- The button uses `-mt-5` (or `-mt-6`) to push the button center above the bar's top edge.
- The button's own size (`w-14 h-14` = 56px) is **larger than the bar height** (56px bar, but the button protrudes 20–24px above it).
- The bar itself does NOT need extra height — the button overlaps upward.
- The tab bar container must use `overflow-visible` (which is the default) so the protruding button is not clipped. Do NOT add `overflow-hidden` to the nav or any parent up to the viewport.
- Use `z-50` on the nav and ensure the button's stacking order renders above page content.

### Full example with center FAB

```tsx
<nav className="fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)] bg-background/95 backdrop-blur-md border-t border-border">
  <div className="flex items-stretch h-14">
    {/* Left tabs */}
    <button className="flex flex-1 flex-col items-center justify-center gap-0.5 text-primary">
      <Home className="h-5 w-5" />
      <span className="text-[10px] font-medium">首页</span>
    </button>
    <button className="flex flex-1 flex-col items-center justify-center gap-0.5 text-muted-foreground">
      <BarChart2 className="h-5 w-5" />
      <span className="text-[10px] font-medium">统计</span>
    </button>

    {/* Center FAB slot — larger button protrudes above bar */}
    <div className="flex flex-1 justify-center items-center">
      <button className="w-14 h-14 -mt-5 rounded-full bg-primary shadow-lg shadow-primary/30 flex items-center justify-center transition-transform active:scale-95">
        <Plus className="h-6 w-6 text-primary-foreground" />
      </button>
    </div>

    {/* Right tabs */}
    <button className="flex flex-1 flex-col items-center justify-center gap-0.5 text-muted-foreground">
      <BookOpen className="h-5 w-5" />
      <span className="text-[10px] font-medium">学习</span>
    </button>
    <button className="flex flex-1 flex-col items-center justify-center gap-0.5 text-muted-foreground">
      <User className="h-5 w-5" />
      <span className="text-[10px] font-medium">我的</span>
    </button>
  </div>
</nav>
```

### Center FAB Specs

| Property | Value |
|---|---|
| Button size | `w-14 h-14` (56px) — must be larger than regular tab icons |
| Protrusion | `-mt-5` to `-mt-6` (20–24px above bar top edge) |
| Shape | `rounded-full` |
| Background | `bg-primary` (or accent color); always use design system token |
| Shadow | `shadow-lg shadow-primary/30` — depth cue that it floats |
| Icon size | `h-6 w-6` (24px) — slightly larger than regular tab icons |
| Icon color | `text-primary-foreground` |
| Press state | `active:scale-95 transition-transform` |
| Label | **None** — the FAB is icon-only; its primary purpose is visually self-evident |

### When to use a center FAB

Apply this pattern when the app's core action is "create / add / record / compose" and it should be instantly reachable. Common signals in the brief:
- "记录", "发布", "添加", "创建", "上传", "打卡"
- "post", "create", "add", "record", "upload", "check in"

## Tab Count & Labels

- **Minimum**: 2 tabs. **Maximum**: 5 tabs. Do NOT render more than 5.
- Label text MUST match the project language (see Language Rule in system prompt). Do NOT use English labels if the project language is not English.
- Labels must be concise: 2–4 characters for CJK, 1–2 words for Latin scripts.
- Icon must be semantically related to the section it represents.
- Common icon choices (use Lucide or inline SVG):
  - Home / feed → `Home`, `LayoutGrid`, `Compass`
  - Profile / me → `User`, `CircleUser`
  - Search / discover → `Search`, `Telescope`
  - Create / compose → `Plus`, `PenLine`, `FilePlus`
  - Notifications → `Bell`, `BellRing`
  - Settings → `Settings`, `SlidersHorizontal`

## Content Area Compensation

Scrollable content inside `AppScreen` must account for the fixed tab bar height.
Add `pb-14` (or `pb-[calc(56px+env(safe-area-inset-bottom))]` for precision) to the scrollable content wrapper so the last item is not obscured.

```tsx
<main className="flex-1 overflow-y-auto pb-[calc(56px+env(safe-area-inset-bottom))]">
  {/* page content */}
</main>
```

## State Management

Use `useState` for the active tab. Keep it inside `AppScreen` — no external state needed.

```tsx
"use client"
const [activeTab, setActiveTab] = useState<string>("home")
```

## Anti-Patterns (do NOT do these)

- Do NOT use `position: absolute` on the bar — this breaks when content height varies.
- Do NOT omit `pb-[env(safe-area-inset-bottom)]` — the bar will be clipped on iPhone.
- Do NOT make the bar taller than `h-16` (64px) — wastes vertical real estate.
- Do NOT use more than 5 tabs — collapses into unusable touch targets.
- Do NOT hide the label — icon-only tabs hurt discoverability.
- Do NOT use emoji as icons — use design-system icon tokens or Lucide icons.
- Do NOT apply `overflow-hidden` to the bar wrapper or any ancestor — clips both safe-area padding and the protruding center FAB.
- **Do NOT implement a center FAB by only shifting its position up (`-top-N`) while keeping the button the same size as other tabs** — this creates dead whitespace below the button inside the bar. The button itself must be physically larger (`w-14 h-14`) and use `-mt-N` to protrude upward into the content area.
