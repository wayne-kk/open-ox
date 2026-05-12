# Component Skill: Hero — Unicorn Studio Full-Bleed Embed (Background)

Unicorn Studio scene as **full-bleed background**; foreground hero (headline, CTAs) above on z-index. Snippet is background-only (`data-us-project` mount)—wrap in **`relative`** section with real copy; **do not** paste inline IIFE into JSX.

**Runtime:** Loads **`unicornStudio.umd.js`** from a **pinned** jsDelivr tag (common exports: **`v2.0.5`**, **`v2.1.1`**—use **exactly** the URL from **your** Unicorn export or **lock** one version team-wide). **Self-host** the UMD in **`public/`** for **CSP** and **supply-chain** control—do not silently float **`@main`**.

## Core Effect

- **Mount target**: **`absolute inset-0`** (or **`left-0 top-0 w-full h-full`**) **layer** with **`z-index`** **below** all hero content (reference **`-z-10`** inside a **stacking context**—if **negative `z` fails**, use **`z-0`** on embed + **`z-10`** on content **instead**).
- **Project binding**: **`data-us-project="<id>"`** on the **mount element** (ID **from brief/CMS/env only**—do **not** treat any **paste** from a demo embed as canonical).
- **Initialization**: After **`UnicornStudio`** UMD loads, call **`UnicornStudio.init()`** (or **`u.init()`** if alias)—**once** per page load pattern; **guard** against **double** init (loader snippet sets **`isInitialized`** flag—mirror that logic in app code).
- **Foreground**: **Must** exist: **typography, CTAs, optional media** in **sibling** nodes **`relative z-10`** (or higher)—this skill does **not** replace **copy** with an **empty** background.

## Visual Language

- **Palette**: **Scene colors come from the Unicorn Studio project**—align **foreground** text/gradients to **brief tokens** so **type** stays legible (**scrim**, **text-shadow**, or **blur card** behind copy if needed).
- **Contrast**: Treat embed as **possibly busy**—**default** assumption: **add** a **token-based** **vignette** or **left/right** **gradient scrim** **above** the embed (**below** text) **when** WCAG checks fail.

## Structure Requirements

- **No site navigation** in this section (**standard** hero rule).
- **Order (bottom → top)**:
  1. **`section`** (or wrapper): **`relative`**, **`min-h-screen`** (or **`h-screen`** / **`min-h-[100dvh]`** per product).
  2. **Unicorn mount** `div` (**first** or **early** child for predictable stacking).
  3. Optional **scrim** layers **`pointer-events-none`**.
  4. **Content** column (**interactive** elements here).

## Motion Direction

- **Embeds own motion**—do **not** duplicate **parallax** that fights the WebGL/canvas **unless** brief demands.
- **`prefers-reduced-motion: reduce`**: **hide** the mount **`aria-hidden`** + **`visibility: hidden`** **or** swap to **static poster image** / **solid** token fill **if** Unicorn export does not expose a **pause** API—**document** the **chosen** **fallback** in code comments **per** brand policy.

## Third-Party Loader (Production)

**Forbidden in React deliverables:** dumping the **minified** **bootstrap** **`<script>`** block from the **export** into **`dangerouslySetInnerHTML`**.

**Required patterns (pick one):**

1. **`next/script`** with **`src`** pointed at **self-hosted** or **pinned** URL, **`strategy="beforeInteractive"`** or **`afterInteractive`** per Unicorn docs; **`onLoad`** → **`window.UnicornStudio?.init?.()`**.
2. **`useEffect`** that **injects** **one** `<script>` **tag** with **`src`**, **`async`**, **idempotency** key (`data-us-loader`), **cleanup** **removeChild** only if **safe** (avoid **breaking** other embeds).

**CSP:** Allow **`script-src`** host (self or **`cdn.jsdelivr.net`**) and any **`connect-src` / `worker-src`** Unicorn projects require—**verify** in **staging**.

## Required Implementation Blueprint (Do Not Skip)

When this skill is selected, the generated hero MUST include all of the following:

1. **Hero wrapper** **`relative`** with **explicit** **min-height** for **first screen** and **defined stacking** (embed **below** content).
2. **Mount `div`**: **`absolute` full-bleed** (or **`fixed`** **only** if product standard uses **viewport-locked** backgrounds), carrying **`data-us-project`** from **brief**, **not** a **hard-coded** demo ID **unless** brief supplies it.
3. **Single** **loader** path: **no** **duplicate** **`<script src="…unicornStudio.umd.js">`** **inserts** on **re-render**; **guarded** **append** or **`next/script`** **once**.
4. **`UnicornStudio.init()`** (or **documented** **successor** API) invoked **after** script **`onload`** **and** when **DOM** **ready**—mirror **reference** **readyState** branching **without** **nested** duplicate **listeners** on **Strict Mode** **double-mount** (**use** **ref** flag **`didInit`** **or** **global** **singleton** **guard**).
5. **Foreground** **hero** **content**: **at least** **headline** + **one** **primary** **action** **or** **supporting** **line**—**not** embed **alone**.
6. **`pointer-events`**: use **`pointer-events-none`** on the mount when the scene must **not** capture clicks meant for CTAs; omit only when the brief requires interactive embed targets and z-order is intentionally coordinated.
7. **Accessibility**: **decorative** **mount** **`aria-hidden="true"`** **when** **non-interactive**; **if** interactive, **ensure** **focus** **order** **and** **labels** **per** **Unicorn** **export** **docs**.
8. **Cleanup**: On **unmount**, **if** **`UnicornStudio`** exposes **`destroy` / `dispose` / `kill`** for **project** **id**, **call** it; **else** **document** **known** **limitation** **(no-op** **cleanup)** **in** **file** **comment**.
9. **No** **`iconify-icon`**, **no** **`cdn.tailwindcss.com`**, **no** **copy-pasted** **export** **snippet** as **only** **integration**—**integrate** **via** **React** **patterns** **above**.
10. **Versioning**: **Pin** **UMD** **to the tag in the export** (e.g. **`v2.0.5`**, **`v2.1.1`**) **or** **vendor** **into** **repo**—**no** **unpinned** **`@latest`**. If **multiple** heroes use **different** pins, **confirm** runtime **compatibility** with Unicorn docs.

If any item above is missing, the output is **NOT** valid for `unicorn-studio-embed-hero-bg`.

## Reference TSX Skeleton (Adapt, Do Not Copy Blindly)

```tsx
"use client"

import { useEffect, useRef, useId } from "react"
import Script from "next/script"

declare global {
  interface Window {
    UnicornStudio?: { isInitialized?: boolean; init?: () => void }
  }
}

/** Match your Unicorn export URL exactly; common pins include v2.1.1 and v2.0.5. */
const UNICORN_UMD =
  "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.1.1/dist/unicornStudio.umd.js"

type UnicornStudioEmbedHeroProps = {
  projectId: string
  /** Hero foreground — required */
  children: React.ReactNode
  scriptSrc?: string
}

function runUnicornInit() {
  const u = window.UnicornStudio
  if (!u?.init) return
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => u.init?.(), { once: true })
  } else {
    u.init()
  }
}

export function UnicornStudioEmbedHero({
  projectId,
  children,
  scriptSrc = UNICORN_UMD,
}: UnicornStudioEmbedHeroProps) {
  const mountId = useId().replace(/:/g, "")
  const didLoadRef = useRef(false)

  useEffect(() => {
    if (didLoadRef.current && window.UnicornStudio?.init) {
      runUnicornInit()
    }
    return () => {
      // Call UnicornStudio teardown if/when your pinned SDK documents it.
    }
  }, [])

  return (
    <section className="relative isolate min-h-screen w-full overflow-hidden">
      <Script
        id={`unicorn-umd-${mountId}`}
        src={scriptSrc}
        strategy="afterInteractive"
        onLoad={() => {
          didLoadRef.current = true
          runUnicornInit()
        }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
        data-us-project={projectId}
      />

      <div className="relative z-10">{children}</div>
    </section>
  )
}
```

**Composition example**

```tsx
<UnicornStudioEmbedHero projectId={process.env.NEXT_PUBLIC_UNICORN_PROJECT_ID ?? ""}>
  <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-24">
    <h1 className="text-4xl font-semibold text-white">Headline from brief</h1>
    <p className="text-white/80">Supporting copy.</p>
    {/* CTAs */}
  </div>
</UnicornStudioEmbedHero>
```

## Layout Details

- **`isolate`** on **`section`** helps **contain** **`z-index`** / **blend** **isolation** when **Unicorn** uses **mix-blend** **internally**.
- If **`-z-10`** **clips** **or** **vanishes**, **remove** **negative** **`z`** and **use** **explicit** **`z-0` / `z-10`**.

## Content Rules

- **Project id** is **environment-specific**—**never** **commit** **private** **IDs** **as** **only** **source**; **use** **env** **vars** **or** **CMS**.

## Implementation Constraints

- **`use client`** on **wrapper** that **depends** on **`onLoad`** / **effects** **if** not **using** **only** **`Script`** **+** **server** **children** **pattern**.
- **Follow** **workspace** **rules**: **no** **`eval`** **of** **user-controlled** **project** **strings** **without** **validation**.

## Accessibility + Performance

- **Heavy** **GPU** **embed**—**lazy** **initialize** **below** **fold** **only** **if** **LCP** **allows**; **hero** **background** **usually** **`priority`** **loads** **embed** **—** **measure** **Lighthouse**.
- **Reduced motion** **path** **required** **(see** **Motion**)**.
