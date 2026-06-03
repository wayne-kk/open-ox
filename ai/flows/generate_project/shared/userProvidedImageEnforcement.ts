import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolExecutor, ToolResult } from "@/ai/tools/types";
import { generateImageTool } from "@/ai/tools/system/generateImageTool";
import { getSiteRoot } from "@/ai/tools/system/common";
import type { UserProvidedContent } from "../types";

const TSX_EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js", ".mdx"]);

function walkTsxFiles(dir: string, files: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const abs = join(dir, name);
    let stat;
    try {
      stat = statSync(abs);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walkTsxFiles(abs, files);
    } else if (TSX_EXTENSIONS.has(name.slice(name.lastIndexOf(".")))) {
      files.push(abs);
    }
  }
}

function readSiteSourceBundle(): string {
  const root = getSiteRoot();
  const roots = ["app", "components"].map((d) => join(root, d));
  const files: string[] = [];
  for (const dir of roots) {
    walkTsxFiles(dir, files);
  }
  return files.map((f) => readFileSync(f, "utf-8")).join("\n");
}

const GOOGLE_USER_IMAGE_URL_RE =
  /https:\/\/lh3\.googleusercontent\.com\/[^\s)\]`"'<>]+/gi;

export function extractGoogleImageUrlsFromText(text: string): string[] {
  if (!text.trim()) return [];
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const match of text.matchAll(GOOGLE_USER_IMAGE_URL_RE)) {
    const url = match[0]?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

export function listUserProvidedImageUrls(
  content: UserProvidedContent | undefined,
  fallbackText?: string
): string[] {
  const fromContent = (content?.images ?? [])
    .map((img) => img.url?.trim())
    .filter(Boolean) as string[];
  if (fromContent.length > 0) return fromContent;
  return extractGoogleImageUrlsFromText(fallbackText ?? "");
}

/** How many distinct user URLs appear in current site TSX/JS sources. */
export function countUserProvidedUrlsInSite(urls: string[]): number {
  if (urls.length === 0) return 0;
  const bundle = readSiteSourceBundle();
  let found = 0;
  for (const url of urls) {
    if (bundle.includes(url)) found += 1;
  }
  return found;
}

export function buildGenerateImageToolForPageAgent(userUrlCount: number): ChatCompletionTool {
  if (userUrlCount <= 0) return generateImageTool;
  return {
    type: "function",
    function: {
      ...generateImageTool.function,
      description:
        `Generate an AI image ONLY after all ${userUrlCount} user-provided photo URL(s) are already embedded ` +
        `as remote https src in app/ or components/ TSX. Never use this tool to replace user Google Places photos. ` +
        "Returns a path under public/images/ for extra decorative slots only.",
      parameters: generateImageTool.function.parameters,
    },
  };
}

export function guardGenerateImageExecutor(
  baseExecutor: ToolExecutor,
  userUrls: string[]
): ToolExecutor {
  if (userUrls.length === 0) return baseExecutor;

  return async (args: Record<string, unknown>): Promise<ToolResult> => {
    const bundle = readSiteSourceBundle();
    const embedded = userUrls.filter((url) => bundle.includes(url)).length;
    if (embedded < userUrls.length) {
      const missing = userUrls
        .filter((url) => !bundle.includes(url))
        .map((url, i) => `${i + 1}. ${url}`);
      return {
        success: false,
        error:
          `generate_image blocked: embed all ${userUrls.length} user-provided image URL(s) in TSX first ` +
          `(${embedded}/${userUrls.length} found). Use each URL once as remote src. Missing:\n` +
          missing.join("\n"),
      };
    }
    return baseExecutor(args);
  };
}
