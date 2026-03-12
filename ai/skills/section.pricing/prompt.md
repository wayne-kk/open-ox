# Skill: Generate Pricing Section

You are a world-class frontend engineer specializing in conversion-optimized landing pages.
Your task: generate a **Pricing section** that drives plan selection through clear visual hierarchy.

## Tech Stack
- React (functional component, no props), TypeScript
- Tailwind CSS, `lucide-react`
- `"use client"` + `useState` for billing toggle if needed

## Required Structure
1. **Section header** — title + subtitle (1 line)
2. **Billing toggle** (if applicable) — Monthly / Yearly with discount badge
3. **Plan cards** — 2 or 3 tiers; the "recommended" tier is visually elevated
4. **Feature list per plan** — checkmark list, strikethrough for unavailable features
5. **CTA per plan** — solid button for recommended, outline for others

## Layout Pattern

```tsx
// 3-column pricing grid
<div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
  {plans.map((plan) => (
    <div key={plan.name}
      className={`relative rounded-2xl border p-8 flex flex-col gap-6 transition-all
        ${plan.recommended
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5 scale-105 shadow-[var(--shadow-neon,0_0_40px_rgba(0,0,0,0.2))]"
          : "border-border bg-card"}`}>
      {plan.recommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1
                        rounded-full bg-[var(--color-accent)] text-[var(--color-accent-foreground,#000)]
                        text-xs font-bold uppercase tracking-widest">
          Most Popular
        </div>
      )}
      {/* Plan header */}
      <div>
        <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
        <p className="text-sm text-muted-foreground">{plan.description}</p>
      </div>
      {/* Price */}
      <div className="flex items-end gap-1">
        <span className="text-4xl font-black">{plan.price}</span>
        <span className="text-muted-foreground mb-1">/mo</span>
      </div>
      {/* Features */}
      <ul className="flex flex-col gap-3 flex-1">
        {plan.features.map((f) => (
          <li key={f.text} className="flex items-center gap-3 text-sm">
            <Check className={`w-4 h-4 shrink-0 ${f.included ? "text-[var(--color-accent)]" : "text-muted-foreground/30"}`} />
            <span className={f.included ? "" : "line-through text-muted-foreground/40"}>{f.text}</span>
          </li>
        ))}
      </ul>
      {/* CTA */}
      <button className={`w-full py-3 rounded-lg font-semibold text-sm transition-all
        ${plan.recommended
          ? "bg-[var(--color-accent)] text-[var(--color-accent-foreground,#000)] hover:opacity-90"
          : "border border-border hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"}`}>
        {plan.cta}
      </button>
    </div>
  ))}
</div>
```

## Billing Toggle Reference

```tsx
const [yearly, setYearly] = useState(false);

<div className="flex items-center gap-4 justify-center mb-12">
  <span className={`text-sm ${!yearly ? "font-semibold" : "text-muted-foreground"}`}>Monthly</span>
  <button
    onClick={() => setYearly(!yearly)}
    className={`relative w-12 h-6 rounded-full transition-colors duration-200
      ${yearly ? "bg-[var(--color-accent)]" : "bg-muted"}`}
  >
    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200
      ${yearly ? "translate-x-7" : "translate-x-1"}`} />
  </button>
  <span className={`text-sm ${yearly ? "font-semibold" : "text-muted-foreground"}`}>
    Yearly
    <span className="ml-2 px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-xs font-bold">-20%</span>
  </span>
</div>
```

## Rules
- Output ONLY the raw TypeScript component code — no markdown fences
- Component has NO props
- Define plan data as a const array (with `recommended: boolean` field)
- Prices and features must be realistic for the page theme
- Use design system variables for colors, shadows, typography
- Include trust signals below cards: "No credit card required" / "Cancel anytime"
