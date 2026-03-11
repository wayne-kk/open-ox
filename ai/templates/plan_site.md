# Template: Plan Site

Use this template when the user requests a new site or page structure.

## DSL Placeholders

```
{{system}}
{{context}}

## User Request
{{input}}

## Output Format
{{output_format}}
```

## Variables

- `{{system}}` - System prompt (planner.md)
- `{{context}}` - Existing project structure, tech stack
- `{{input}}` - User's description of desired site
- `{{output_format}}` - output_json.md (site plan JSON)

## Flow

1. Parse user intent
2. Infer pages and sections
3. Output structured plan (JSON)
4. Plan feeds into generate_layout / generate_section
