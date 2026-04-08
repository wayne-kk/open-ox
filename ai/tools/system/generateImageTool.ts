/**
 * generate_image tool — 立即返回确定性路径给 LLM（不阻塞），
 * 实际 Ark API 生图 + 写盘在后台异步执行。
 *
 * 调用方通过 pendingImages 收集所有 Promise，在需要图片就绪时（如 build 前）统一 await。
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";
import { getSiteRoot } from "./common";
import { generateArkImageBase64 } from "@/lib/ark-image-generate";

// ── Concurrency limiter for Ark API ─────────────────────────────────────

const MAX_CONCURRENT_GENERATIONS = 5;
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
            "Detailed image generation prompt in English. Describe the subject, style, mood, lighting, " +
            "composition, and color palette. Be specific for best results.",
        },
        size: {
          type: "string",
          description:
            'Image size: "1K" for normal images, "2K" for hero/full-bleed backgrounds. Default "1K".',
        },
      },
      required: ["filename", "prompt"],
    },
  },
};

function sanitizeFilename(raw: string): string {
  return raw
    .replace(/\.png$/i, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "image";
}

// ── Pending image tracking ──────────────────────────────────────────────

export interface PendingImage {
  filename: string;
  prompt: string;
  size: string;
  publicPath: string;
  /** Resolves when the image file has been written to disk. */
  promise: Promise<void>;
}

/**
 * Create a scoped image executor that returns paths instantly and collects
 * background generation promises.
 *
 * Usage:
 *   const { executor, pendingImages } = createImageExecutor("HeroSection");
 *   // pass executor as executeToolOverrides["generate_image"]
 *   // after LLM finishes, await Promise.allSettled(pendingImages.map(p => p.promise))
 */
export function createImageExecutor(componentName: string): {
  executor: ToolExecutor;
  pendingImages: PendingImage[];
} {
  const pendingImages: PendingImage[] = [];

  const executor: ToolExecutor = async (
    args: Record<string, unknown>
  ): Promise<ToolResult> => {
    const rawName = String(args.filename ?? "image");
    const filename = sanitizeFilename(`${componentName}-${rawName}`);
    const prompt = String(args.prompt ?? "");
    const size = String(args.size ?? "1K");
    const publicPath = `/images/${filename}.png`;

    if (!prompt.trim()) {
      return { success: false, error: "prompt is required" };
    }

    const apiKey = process.env.ARK_API_KEY?.trim();
    if (!apiKey) {
      const w = size === "2K" ? 1920 : 1200;
      const h = size === "2K" ? 1080 : 675;
      const fallbackUrl = `https://picsum.photos/seed/${filename}/${w}/${h}`;
      console.warn(`[generate_image] ARK_API_KEY not set, using placeholder: ${fallbackUrl}`);
      return {
        success: true,
        output: `No ARK_API_KEY configured. Use this placeholder URL directly in src: ${fallbackUrl}`,
        meta: { path: fallbackUrl, filename, placeholder: true },
      };
    }

    // Fire-and-forget: enqueue the actual generation in the background
    const generationPromise = (async () => {
      await acquireSlot();
      try {
        console.log(`[generate_image] Generating "${filename}" (size=${size})...`);
        const b64 = await generateArkImageBase64({ prompt, size });
        const buf = Buffer.from(b64, "base64");

        const siteRoot = getSiteRoot();
        const imagesDir = join(siteRoot, "public", "images");
        if (!existsSync(imagesDir)) {
          mkdirSync(imagesDir, { recursive: true });
        }

        writeFileSync(join(imagesDir, `${filename}.png`), buf);
        console.log(`[generate_image] Saved ${publicPath} (${buf.length} bytes)`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[generate_image] Failed to generate "${filename}":`, msg);
      } finally {
        releaseSlot();
      }
    })();

    pendingImages.push({ filename, prompt, size, publicPath, promise: generationPromise });

    // Return immediately — LLM gets the path without waiting for Ark API
    return {
      success: true,
      output: `Image will be generated. Use this path in your component: ${publicPath}`,
      meta: { path: publicPath, filename },
    };
  };

  return { executor, pendingImages };
}

/**
 * Await all pending image generation promises. Call before build step.
 * Returns a summary of results.
 */
export async function awaitPendingImages(
  pending: PendingImage[]
): Promise<{ total: number; settled: number; failed: number }> {
  if (pending.length === 0) return { total: 0, settled: 0, failed: 0 };

  console.log(`[generate_image] Awaiting ${pending.length} pending image(s)...`);
  const results = await Promise.allSettled(pending.map((p) => p.promise));

  let failed = 0;
  for (const r of results) {
    if (r.status === "rejected") failed++;
  }

  console.log(`[generate_image] ${pending.length} images done, ${failed} failed`);
  return { total: pending.length, settled: pending.length - failed, failed };
}
