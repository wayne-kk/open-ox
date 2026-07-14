/**
 * Parse Feishu DM text into bot commands vs plain Modify/continuation text.
 */

export type FeishuBotCommand =
  | { kind: "help" }
  | { kind: "status" }
  | { kind: "clear" }
  | { kind: "projects" }
  | { kind: "use"; query: string }
  | { kind: "unknown_slash"; raw: string }
  | { kind: "modify_text"; text: string };

const SLASH = /^\/([a-zA-Z_\u4e00-\u9fff]+)(?:\s+(.*))?$/s;

export function parseFeishuBotMessage(raw: string): FeishuBotCommand {
  const text = raw.trim();
  if (!text) {
    return { kind: "modify_text", text: "" };
  }

  const match = text.match(SLASH);
  if (!match) {
    return { kind: "modify_text", text };
  }

  const cmd = (match[1] ?? "").toLowerCase();
  const rest = (match[2] ?? "").trim();

  switch (cmd) {
    case "help":
    case "帮助":
      return { kind: "help" };
    case "status":
    case "当前":
      return { kind: "status" };
    case "clear":
      return { kind: "clear" };
    case "projects":
    case "list":
    case "项目":
    case "换绑":
      return { kind: "projects" };
    case "use":
    case "switch":
    case "换":
      return { kind: "use", query: rest };
    default:
      return { kind: "unknown_slash", raw: text };
  }
}

export function feishuHelpText(): string {
  return [
    "Open-OX 飞书改站",
    "",
    "直接发改站说明即可（如：Hero 再大一点）。",
    "",
    "/projects 或 /换绑 — 列出项目",
    "/use <名或序号> — 换绑当前项目",
    "/status — 看当前绑的是哪个",
    "/clear — 取消追问续写",
    "/help — 本说明",
    "",
    "也可在 Studio 点「飞书改」一键打开这里。",
    "暂不支持图片。",
  ].join("\n");
}
