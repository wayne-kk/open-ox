/** Map file path extension to Monaco `language` id. */
export function inferMonacoLanguage(filePath: string | null): string {
  if (!filePath) return "plaintext";
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "javascript";
    case "json":
      return "json";
    case "css":
      return "css";
    case "scss":
    case "sass":
      return "scss";
    case "html":
    case "htm":
      return "html";
    case "md":
    case "mdx":
      return "markdown";
    case "yml":
    case "yaml":
      return "yaml";
    case "sql":
      return "sql";
    case "sh":
    case "bash":
      return "shell";
    case "py":
      return "python";
    default:
      return "plaintext";
  }
}
