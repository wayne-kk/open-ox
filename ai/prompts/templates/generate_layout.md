# Template: Generate Layout

Use this template when generating a full page layout that composes multiple sections.

## DSL Placeholders

```
{{system}}
{{layout_skill}}
{{design_rules}}
{{sections_spec}}

## Task
Generate the {{layout_type}} layout composing the following sections.

## Sections (in order)
{{sections}}

## Output Format
{{output_format}}
```

## Variables

- `{{system}}` - System prompt (frontend.md)
- `{{layout_skill}}` - Layout skill (e.g. layout.landing.md)
- `{{design_rules}}` - From dsl/design_rules.md
- `{{sections_spec}}` - Spec for each section (type, content)
- `{{layout_type}}` - landing | blog | dashboard | ...
- `{{sections}}` - Ordered list with section details
- `{{output_format}}` - output_tsx.md
