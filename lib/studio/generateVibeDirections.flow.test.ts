import { beforeEach, describe, expect, it, vi } from "vitest";

const { callLLMWithMeta } = vi.hoisted(() => ({
  callLLMWithMeta: vi.fn(),
}));

vi.mock("@/ai/flows/generate_project/shared/llm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/ai/flows/generate_project/shared/llm")>()),
  callLLMWithMeta,
}));

import { generateVibeDirections } from "./generateVibeDirections";
import { beginModelRuntimeContext } from "@/lib/config/models";

function completion(content: string) {
  return { content, model: "gemini-3-flash-preview" };
}

function directions(prefix: string, labels: string[]) {
  return JSON.stringify({
    directions: labels.map((label, index) => ({
      id: `${prefix}-${index + 1}`,
      label,
      tagline: `${label}视觉方向`,
      moods: [label, "清晰", "可信"],
      tokens: {
        background: "#ffffff",
        foreground: "#111111",
        muted: "#555555",
        accent: ["#075985", "#166534", "#7c2d12"][index],
        accentForeground: "#ffffff",
        border: "#d4d4d4",
        fontDisplay: "ui-sans-serif, system-ui, sans-serif",
        fontBody: "ui-sans-serif, system-ui, sans-serif",
        radius: `${4 + index * 4}px`,
      },
      mood: `${label}, clear, trustworthy`,
      colorDirection: `${label} palette`,
      style: `${prefix}-${index + 1}`,
      keywords: [prefix, `direction-${index + 1}`],
      paletteNote: `${label} palette`,
      typographyNote: `${label} typography`,
      decorationNote: `${label} decoration`,
      imageryNote: `${label} imagery`,
      forbidden: ["generic SaaS"],
    })),
  });
}

describe("generateVibeDirections alignment flow", () => {
  beforeEach(() => {
    callLLMWithMeta.mockReset();
    beginModelRuntimeContext();
  });

  it("rejects off-brief directions and retries with the review feedback", async () => {
    callLLMWithMeta
      .mockResolvedValueOnce(
        completion(directions("promo", ["潮流发售", "霓虹派对", "折扣冲刺"])),
      )
      .mockResolvedValueOnce(
        completion(
          JSON.stringify({
            aligned: false,
            issues: ["三个方向都没有体现中医院、患者或医疗信任"],
            retryInstruction: "围绕中医诊疗、患者信任和文化底蕴重新生成",
          }),
        ),
      )
      .mockResolvedValueOnce(
        completion(directions("clinic", ["杏林可信", "东方诊疗", "现代中医"])),
      )
      .mockResolvedValueOnce(
        completion(JSON.stringify({ aligned: true, issues: [], retryInstruction: "" })),
      );

    const result = await generateVibeDirections(
      "为一家中医院制作官网，主要面向患者和家属，体现专业可信与中医文化，避免促销感。",
    );

    expect(result.source).toBe("llm");
    expect(result.directions.map((direction) => direction.label)).toEqual([
      "杏林可信",
      "东方诊疗",
      "现代中医",
    ]);
    expect(callLLMWithMeta).toHaveBeenCalledTimes(4);
    expect(callLLMWithMeta.mock.calls[2]?.[1]).toContain("围绕中医诊疗");
  });

  it("returns an observable failure instead of disguising generic defaults as custom output", async () => {
    callLLMWithMeta.mockRejectedValue(new Error("gateway unavailable"));

    const result = await generateVibeDirections("为独立陶艺工作室制作作品集网站");

    expect(result).toMatchObject({
      source: "fallback",
      fallbackReason: "generation_failed",
    });
    expect(callLLMWithMeta).toHaveBeenCalledTimes(2);
  });
});
