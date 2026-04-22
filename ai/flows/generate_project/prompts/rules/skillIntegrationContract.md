## Rule: Skill Integration Contract (critical)

Skills are enhancement references, not page templates. Layout and rhythm always come from:

1. Section Design Brief
2. Section guardrails/rules
3. Design system tokens

When using any skill:

- Keep the existing section outer wrapper model: `<section className="w-full ... py-*">` + inner container.
- Do NOT switch to full-screen takeover patterns (`min-h-screen`, fixed scene shells, standalone nav/hero app shell) unless the brief explicitly asks.
- Do NOT rewrite section composition to a different archetype just to match a skill demo.
- Preserve spacing guardrails (`py` ceiling, density target) and readability constraints.
- Skills may influence visual treatment/effects/details, but must not override structure, route model, or global layout conventions.
