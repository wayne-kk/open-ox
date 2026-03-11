# Template: Generate Section

Use this template when generating a single section (hero, feature, cta, etc.).

## DSL Placeholders

```
{{system}}
{{skill}}
{{design_rules}}
{{context}}

## Task
Generate the {{section_type}} section.

## Input
{{input}}

## Output Format
{{output_format}}
```

## Variables

- `{{system}}` - System prompt (frontend.md)
- `{{skill}}` - Skill prompt (e.g. section.hero.md)
- `{{design_rules}}` - From dsl/design_rules.md
- `{{context}}` - Project context, existing components
- `{{section_type}}` - hero | feature | cta | testimonial | ...
- `{{input}}` - User requirements, copy, placeholders
- `{{output_format}}` - output_tsx.md or output_json.md
