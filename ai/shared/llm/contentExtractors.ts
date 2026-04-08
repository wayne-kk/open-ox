import ts from "typescript";

export function extractContent(raw: string, lang = ""): string {
  const trimmed = raw.trim();
  const escapedLang = lang.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const preferredFenceRe = new RegExp(
    `\\\`\\\`\\\`(?:${escapedLang})?\\s*\\n([\\s\\S]*?)\\n\\\`\\\`\\\``,
    "i"
  );
  const genericFenceRe = /```(?:[a-z0-9_-]+)?\s*\n([\s\S]*?)\n```/i;
  const fencedMatch =
    (lang ? trimmed.match(preferredFenceRe) : null) ?? trimmed.match(genericFenceRe);
  const extracted = fencedMatch ? fencedMatch[1].trim() : trimmed;

  if (lang.toLowerCase() === "tsx") {
    return sanitizeTsxContent(extracted);
  }

  return extracted;
}

export function extractJSON(raw: string): string {
  const stripped = extractContent(raw, "json");
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");

  if (start === -1 || end === -1) {
    return stripped;
  }

  return stripped.slice(start, end + 1);
}

function sanitizeTsxContent(raw: string): string {
  const withoutFenceLines = raw
    .split("\n")
    .filter((line) => !line.trim().startsWith("```"))
    .join("\n")
    .trim();

  if (!withoutFenceLines) {
    return withoutFenceLines;
  }

  const deduped = extractFirstModule(withoutFenceLines);

  const lines = deduped.split("\n");
  for (let end = lines.length; end > 0; end -= 1) {
    const candidate = lines.slice(0, end).join("\n").trimEnd();
    if (!looksLikeTsxModule(candidate)) {
      continue;
    }

    const transpileResult = ts.transpileModule(candidate, {
      compilerOptions: {
        jsx: ts.JsxEmit.Preserve,
        target: ts.ScriptTarget.ESNext,
      },
      fileName: "generated.tsx",
      reportDiagnostics: true,
    });

    if ((transpileResult.diagnostics?.length ?? 0) === 0) {
      return candidate;
    }
  }

  return deduped;
}

function extractFirstModule(content: string): string {
  const lines = content.split("\n");
  let seenExport = false;
  let moduleEndLine = lines.length;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (/^export\s+(default|function|const|class)\b/.test(line)) {
      seenExport = true;
      continue;
    }

    if (seenExport && /^(?:"use client"|'use client'|import\s)/.test(line)) {
      moduleEndLine = i;
      break;
    }
  }

  return lines.slice(0, moduleEndLine).join("\n").trimEnd();
}

function looksLikeTsxModule(content: string): boolean {
  return /(?:^|\n)(?:"use client";|import |export default |export const |function )/m.test(content);
}
