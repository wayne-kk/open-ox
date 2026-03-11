# Template: Tool Call

Use this template when the LLM needs to decide which tool to call or how to format tool arguments.

## DSL Placeholders

```
{{system}}
{{available_tools}}
{{context}}
{{user_request}}

## Task
Determine the appropriate tool(s) to call and provide valid arguments.
```

## Variables

- `{{system}}` - System prompt (frontend.md or planner.md)
- `{{available_tools}}` - List of tools: write_file, read_file, exec_shell, list_dir
- `{{context}}` - Current state, written files, errors
- `{{user_request}}` - User's latest instruction

## Tool Schemas

Tools are passed to LLM as OpenAI function definitions. This template is for few-shot examples or tool-calling instructions when not using native function calling.
