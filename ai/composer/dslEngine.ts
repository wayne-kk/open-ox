/**
 * 轻量级 Handlebars-like DSL 引擎
 * 支持 {{var}}, {{#if var}}, {{#each arr}}, {{/if}}, {{/each}}
 */

type Context = Record<string, unknown>;

// Prompt 场景不需要 HTML 转义，保留原始文本

function get(ctx: Context, path: string): unknown {
  const parts = path.trim().split(".");
  let val: unknown = ctx;
  for (const p of parts) {
    if (val == null) return undefined;
    val = (val as Record<string, unknown>)[p];
  }
  return val;
}

function isTruthy(val: unknown): boolean {
  if (val === undefined || val === null) return false;
  if (typeof val === "boolean") return val;
  if (typeof val === "string") return val.length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === "object") return Object.keys(val).length > 0;
  return true;
}

export function compile(template: string, ctx: Context): string {
  let result = template;

  // {{#each arr}}...{{/each}}
  const eachRegex = /\{\{#each\s+(\S+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
  result = result.replace(eachRegex, (_, path, body) => {
    const arr = get(ctx, path);
    if (!Array.isArray(arr)) return "";
    return arr
      .map((item, i) => {
        const subCtx = { ...ctx, this: item, "@index": i };
        return compile(body, subCtx);
      })
      .join("");
  });

  // {{#if var}}...{{/if}}
  const ifRegex = /\{\{#if\s+(\S+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  result = result.replace(ifRegex, (_, path, body) => {
    const val = get(ctx, path);
    return isTruthy(val) ? compile(body, ctx) : "";
  });

  // {{#unless var}}...{{/unless}}
  const unlessRegex = /\{\{#unless\s+(\S+)\}\}([\s\S]*?)\{\{\/unless\}\}/g;
  result = result.replace(unlessRegex, (_, path, body) => {
    const val = get(ctx, path);
    return !isTruthy(val) ? compile(body, ctx) : "";
  });

  // {{var}} 或 {{path.to.var}}
  const varRegex = /\{\{(\S+)\}\}/g;
  result = result.replace(varRegex, (_, path) => {
    const val = get(ctx, path);
    if (val === undefined || val === null) return "";
    return typeof val === "object" ? JSON.stringify(val) : String(val);
  });

  return result;
}
