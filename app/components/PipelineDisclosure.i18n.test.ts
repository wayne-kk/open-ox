import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import zhCN from "@/messages/zh-CN.json";

const STEP_IDS = [
  "analyze",
  "infer",
  "plan",
  "design",
  "pages",
  "chrome",
  "build",
  "repair",
] as const;

describe("PipelineDisclosure translations", () => {
  it("provides all eight pipeline details in both locales", () => {
    for (const id of STEP_IDS) {
      expect(en.landing.pipelineSteps[id]).toBeTruthy();
      expect(zhCN.landing.pipelineSteps[id]).toBeTruthy();
    }
  });

  it("does not render Chinese fallback copy on the English page", () => {
    for (const detail of Object.values(en.landing.pipelineSteps)) {
      expect(detail).not.toMatch(/[\u3400-\u9fff]/u);
    }
  });
});
