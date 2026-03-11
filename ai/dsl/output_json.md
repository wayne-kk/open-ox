# DSL: Output JSON

When the task requires structured data (site plan, review result, config), output JSON only.

## Rules

- No markdown code blocks (no ```json)
- No explanation before or after
- Valid JSON only
- Use double quotes for strings
- No trailing commas

## Example

```json
{"key": "value", "arr": [1, 2]}
```

## Use Cases

- Site plan (planner)
- Code review result (reviewer)
- Tool call arguments (when not using native function calling)
