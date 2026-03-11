# Template: Fix Code

Use this template when fixing linter/TypeScript/build errors.

## DSL Placeholders

```
{{system}}
{{error_output}}
{{file_content}}
{{file_path}}

## Task
Fix the code to resolve the following errors.
```

## Variables

- `{{system}}` - System prompt (codefix.md)
- `{{error_output}}` - Raw linter/TS/build output
- `{{file_content}}` - Current file content
- `{{file_path}}` - Path for context (e.g. app/page.tsx)

## Flow

1. Verifier produces error output
2. Load file content
3. Compose with codefix system
4. LLM returns corrected code
5. Write back via write_file tool
