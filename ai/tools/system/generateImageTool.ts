/**
 * generate_image tool — 立即返回确定性路径给 LLM（不阻塞），
 * 实际 Ark API 生图 + 写盘在后台异步执行。
 *
 * 调用方通过 pendingImages 收集所有 Promise，在需要图片就绪时（如 build 前）统一 await。
 */

import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";
import {
  generateProjectImage,
  projectImagePath,
  sanitizeImageFilename,
  sanitizeImagePrompt,
} from "@/lib/content/siteImageAsset";

// ── Concurrency limiter for Ark API ─────────────────────────────────────

const MAX_CONCURRENT_GENERATIONS = Math.max(
  1,
  Number(process.env.ARK_IMAGE_MAX_CONCURRENCY ?? 2)
);
let _activeCount = 0;
const _waitQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (_activeCount < MAX_CONCURRENT_GENERATIONS) {
    _activeCount++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    _waitQueue.push(() => { _activeCount++; resolve(); });
  });
}

function releaseSlot(): void {
  _activeCount--;
  const next = _waitQueue.shift();
  next?.();
}

export const generateImageTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "generate_image",
    description:
      "Generate an AI image from a text prompt and save it to the project's public/images/ directory. " +
      "Returns the public path (e.g. /images/hero-bg.png) that can be used directly in <img src> or Next.js Image. " +
      "Use this whenever the section needs a photo, illustration, or visual asset.",
    parameters: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description:
            "Output filename without extension (e.g. 'hero-bg', 'feature-dashboard'). Will be saved as .png. " +
            "Use kebab-case, descriptive names related to the section.",
        },
        prompt: {
          type: "string",
          description:
            "Image generation prompt in English, MUST be under 160 characters. " +
            "Formula: [Subject] + [Style] + [Lighting] + [Mood/Color] + [Quality]. " +
            "Be dense and specific. End with 'sharp focus, 4K'. " +
            "NEVER include any text, words, letters, logos, or UI elements — image must be purely visual.",
        },
        size: {
          type: "string",
          description:
            'Ignored for now. Image size is fixed to "1k".',
        },
      },
      required: ["filename", "prompt"],
    },
  },
};

function sanitizeFilename(raw: string): string {
  return sanitizeImageFilename(raw);
}

function sanitizePrompt(raw: string): string {
  return sanitizeImagePrompt(raw);
}

// ── Pending image tracking ──────────────────────────────────────────────

export interface PendingImage {
  filename: string;
  prompt: string;
  size: string;
  publicPath: string;
  /** Resolves when the image file has been written to disk. */
  promise: Promise<void>;
  /** Generation duration in ms — populated after promise resolves. */
  durationMs: number;
  /** Whether the image was successfully generated and written to disk. */
  success: boolean;
}

/**
 * @param scopeLabel — log / collision disambiguation only. **Not** prefixed onto
 * the public path: models nearly always write `<img src>` from the `filename`
 * argument they passed, so a `page-home-…` prefix caused systematic broken images.
 */
export function createImageExecutor(scopeLabel: string): {
  executor: ToolExecutor;
  pendingImages: PendingImage[];
} {
  const pendingImages: PendingImage[] = [];
  const usedFilenames = new Set<string>();

  const executor: ToolExecutor = async (
    args: Record<string, unknown>
  ): Promise<ToolResult> => {
    const rawName = String(args.filename ?? "image");
    let filename = sanitizeFilename(rawName);
    if (usedFilenames.has(filename)) {
      // Rare same-scope collision — keep the caller's basename readable, append a short suffix.
      const suffix = sanitizeFilename(scopeLabel).slice(0, 24) || "img";
      filename = sanitizeFilename(`${filename}-${suffix}`);
      let n = 2;
      while (usedFilenames.has(filename)) {
        filename = sanitizeFilename(`${sanitizeFilename(rawName)}-${suffix}-${n}`);
        n += 1;
      }
    }
    usedFilenames.add(filename);
    const prompt = sanitizePrompt(String(args.prompt ?? ""));
    const size = "1k";
    const publicPath = projectImagePath(filename, "png");

    if (!prompt.trim()) {
      return { success: false, error: "prompt is required" };
    }

    const apiKey = process.env.ARK_API_KEY?.trim();
    if (!apiKey) {
      const w = 1200;
      const h = 675;
      const fallbackUrl = `https://picsum.photos/seed/${filename}/${w}/${h}`;
      console.warn(`[generate_image] ARK_API_KEY not set, using placeholder: ${fallbackUrl}`);
      return {
        success: true,
        output: `No ARK_API_KEY configured. Use this placeholder URL directly in src: ${fallbackUrl}`,
        meta: { path: fallbackUrl, filename, placeholder: true },
      };
    }

    const pending: PendingImage = {
      filename, prompt, size, publicPath, durationMs: 0, success: false,
      promise: Promise.resolve(),
    };

    pending.promise = (async () => {
      await acquireSlot();
      const t0 = Date.now();
      try {
        console.log(`[generate_image] Generating "${filename}" (size=${size})...`);
        const result = await generateProjectImage({ filenameBase: filename, prompt });
        if (!result.ok) {
          throw new Error(result.error);
        }
        pending.publicPath = result.path;
        pending.durationMs = Date.now() - t0;
        pending.success = true;
        console.log(
          `[generate_image] Saved ${result.path} (${result.bytes} bytes, ${pending.durationMs}ms)`
        );
      } catch (err) {
        pending.durationMs = Date.now() - t0;
        pending.success = false;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[generate_image] Failed to generate "${filename}":`, msg);
      } finally {
        releaseSlot();
      }
    })();

    pendingImages.push(pending);

    return {
      success: true,
      output: `Image will be generated. Use this path in your component: ${publicPath}`,
      meta: { path: publicPath, filename },
    };
  };

  return { executor, pendingImages };
}

export async function awaitPendingImages(
  pending: PendingImage[]
): Promise<{ total: number; settled: number; failed: number }> {
  if (pending.length === 0) return { total: 0, settled: 0, failed: 0 };

  console.log(`[generate_image] Awaiting ${pending.length} pending image(s)...`);
  await Promise.allSettled(pending.map((p) => p.promise));

  const failed = pending.filter((p) => !p.success).length;
  const succeeded = pending.length - failed;

  console.log(`[generate_image] ${succeeded}/${pending.length} images succeeded, ${failed} failed`);
  return { total: pending.length, settled: succeeded, failed };
}
