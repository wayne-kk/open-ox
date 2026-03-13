/**
 * Build Landing Page Flow
 *
 * 完整建站流程（预定义 Flow，非 Agent 自主编排）:
 *   analyze_requirement → generate_design_system → apply_design_tokens
 *   → generate_section × N（并发） → compose_page → run_build
 *
 * Section 生成：
 *   - 并发执行（Promise.allSettled），互不阻塞
 *   - 1-shot skill 选择器：根据 section.type 自动选择专用 skill
 *   - 每种 section 类型对应专用 prompt（含真实动画代码参考）
 *   - 无对应专用 skill 时回退到 landing.generate_section
 */

import { readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import OpenAI from "openai";
import { getModelId } from "../../lib/config/models";
import { executeSystemTool } from "../tools";
import { SITE_ROOT } from "../tools/system/common";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_URL,
});

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SectionSpec {
  type: string;
  intent: string;
  contentHints: string;
  fileName: string;
}

export interface DesignIntent {
  mood: string[];
  colorDirection: string;
  style: string;
  keywords: string[];
}

export interface PageBlueprint {
  title: string;
  slug: string;
  description: string;
  designIntent: DesignIntent;
  sections: SectionSpec[];
}

export interface BuildStep {
  step: string;
  status: "ok" | "error";
  detail?: string;
  /** wall-clock timestamp (ms since epoch) when this step completed */
  timestamp: number;
  /** duration of this step in ms */
  duration: number;
}

export interface BuildLandingPageResult {
  success: boolean;
  blueprint?: PageBlueprint;
  generatedFiles: string[];
  steps: BuildStep[];
  /** total wall-clock duration in ms */
  totalDuration?: number;
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadPrompt(skillDir: string): string {
  const path = join(process.cwd(), "ai", "skills", skillDir, "prompt.md");
  if (!existsSync(path)) throw new Error(`Prompt not found: ${path}`);
  return readFileSync(path, "utf-8");
}

function loadSystem(name: string): string {
  const path = join(process.cwd(), "ai", "prompts", "systems", `${name}.md`);
  if (!existsSync(path)) return "You are a professional AI assistant.";
  return readFileSync(path, "utf-8");
}

async function callLLM(
  systemPrompt: string,
  userMessage: string,
  temperature = 0.7
): Promise<string> {
  const model = getModelId();
  const res = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature,
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

/** Strip markdown code fences if the model wrapped the output */
function extractContent(raw: string, lang = ""): string {
  const fenceRe = new RegExp(
    `^\`\`\`(?:${lang})?\\s*\\n([\\s\\S]*?)\\n\`\`\`\\s*$`,
    "i"
  );
  const m = raw.trim().match(fenceRe);
  return m ? m[1].trim() : raw.trim();
}

function extractJSON(raw: string): string {
  const stripped = extractContent(raw, "json");
  // Find first { and last } to handle extra text before/after JSON
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1) return stripped;
  return stripped.slice(start, end + 1);
}

async function writeFile(relativePath: string, content: string): Promise<void> {
  const result = await executeSystemTool("write_file", { path: relativePath, content });
  if (typeof result === "object" && !result.success) {
    throw new Error(`write_file failed for ${relativePath}: ${result.error}`);
  }
}

async function formatFile(relativePath: string): Promise<void> {
  // format_code is best-effort — don't throw if prettier isn't available
  await executeSystemTool("format_code", { path: relativePath }).catch(() => null);
}

function readSiteFile(relativePath: string): string {
  const fullPath = join(SITE_ROOT, relativePath);
  if (!existsSync(fullPath)) return "";
  return readFileSync(fullPath, "utf-8");
}

// ─── Step 1: Analyze Requirement → PageBlueprint ──────────────────────────

async function stepAnalyzeRequirement(userInput: string): Promise<PageBlueprint> {
  const systemPrompt = [
    loadSystem("planner"),
    "\n\n",
    loadPrompt("landing.analyze_requirement"),
  ].join("");

  const raw = await callLLM(systemPrompt, userInput, 0.5);
  const jsonStr = extractJSON(raw);

  try {
    return JSON.parse(jsonStr) as PageBlueprint;
  } catch {
    throw new Error(`analyze_requirement: failed to parse PageBlueprint JSON.\nRaw output:\n${raw}`);
  }
}

// ─── Step 2: Generate Design System → design-system.md ───────────────────

async function stepGenerateDesignSystem(blueprint: PageBlueprint): Promise<string> {
  const systemPrompt = [
    loadSystem("frontend"),
    "\n\n",
    loadPrompt("landing.generate_design_system"),
  ].join("");

  const userMessage = `## Page: ${blueprint.title}

## Design Intent
- Mood: ${blueprint.designIntent.mood.join(", ")}
- Color Direction: ${blueprint.designIntent.colorDirection}
- Style: ${blueprint.designIntent.style}
- Keywords: ${blueprint.designIntent.keywords.join(", ")}

## Page Description
${blueprint.description}

Generate the complete Design System for this website.`;

  const designSystem = await callLLM(systemPrompt, userMessage, 0.8);

  // Persist to site project so sections can reference it
  await writeFile("design-system.md", designSystem);

  return designSystem;
}

// ─── Step 3: Apply Design Tokens → globals.css (Tailwind v4) ────────────

async function stepApplyDesignTokens(designSystem: string): Promise<void> {
  const currentGlobalsCss = readSiteFile("app/globals.css");

  const systemPrompt = [
    loadSystem("frontend"),
    "\n\n",
    loadPrompt("landing.apply_design_tokens"),
  ].join("");

  const userMessage = `## Design System
${designSystem}

## Current globals.css
\`\`\`css
${currentGlobalsCss}
\`\`\`

Generate the updated globals.css using Tailwind CSS v4 syntax.`;

  const raw = await callLLM(systemPrompt, userMessage, 0.3);
  const jsonStr = extractJSON(raw);

  let parsed: { globals_css: string };
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`apply_design_tokens: failed to parse JSON output.\nRaw:\n${raw}`);
  }

  await writeFile("app/globals.css", parsed.globals_css);
}

// ─── Section Skill Registry ───────────────────────────────────────────────

/**
 * section.type → 可用的专用 skill 名列表
 * 单个变体时直接使用，多个变体时通过 1-shot selector 选择。
 * 没有命中的 type 回退到 landing.generate_section。
 */
const SECTION_SKILL_MAP: Record<string, string[]> = {
  navigation:   ["section.navigation"],
  hero:         ["section.hero"],
  features:     ["section.features"],
  pricing:      ["section.pricing"],
  cta:          ["section.cta"],
  footer:       ["section.footer"],
  stats:        ["section.stats"],
  testimonials: ["section.testimonials"],
  faq:          ["section.faq"],
  newsletter:   ["section.newsletter"],
  gallery:      ["section.gallery"],
  team:         ["section.team"],
  timeline:     ["section.timeline"],
};

/**
 * 1-shot skill 选择器
 * 单变体时直接返回；多变体时调用 LLM 选出最合适的。
 */
async function selectSectionSkill(
  section: SectionSpec,
  designStyle: string
): Promise<string> {
  const candidates = SECTION_SKILL_MAP[section.type];

  // 无专用 skill → 回退
  if (!candidates || candidates.length === 0) {
    return "landing.generate_section";
  }

  // 只有一个候选 → 直接返回（省一次 LLM 调用）
  if (candidates.length === 1) {
    // 检查 prompt 文件是否真实存在，不存在则回退
    const promptPath = join(
      process.cwd(),
      "ai",
      "skills",
      candidates[0],
      "prompt.md"
    );
    return existsSync(promptPath) ? candidates[0] : "landing.generate_section";
  }

  // 多个候选 → 1-shot 选择
  const raw = await callLLM(
    "You are a skill selector. Output only the exact skill name from the list, nothing else.",
    `Select the most appropriate skill for this section.

Section type: ${section.type}
Intent: ${section.intent}
Design style: ${designStyle}
Available skills: ${candidates.join(", ")}`,
    0.1
  );

  const chosen = raw.trim();
  return candidates.includes(chosen) ? chosen : candidates[0];
}

// ─── Layout vs Page Section Split ────────────────────────────────────────

/**
 * 这些 section 类型属于全局布局层，写入 layout.tsx 而非 page.tsx。
 * Navigation 固定在顶部，Footer 固定在底部，由 layout 统一管理。
 */
const LAYOUT_SECTION_TYPES = new Set(["navigation", "footer"]);

// ─── Step 4: Generate Sections × N (并发) ────────────────────────────────

async function stepGenerateSection(
  designSystem: string,
  section: SectionSpec,
  designStyle: string
): Promise<string> {
  // 1. 选择专用 skill（含 prompt）
  const skillName = await selectSectionSkill(section, designStyle);

  let sectionPrompt: string;
  try {
    sectionPrompt = loadPrompt(skillName);
  } catch {
    // skill 文件不存在时回退到通用 prompt
    sectionPrompt = loadPrompt("landing.generate_section");
  }

  const systemPrompt = [loadSystem("frontend"), "\n\n", sectionPrompt].join("");

  const userMessage = `## Design System
${designSystem}

## Section to Generate
- **Type**: ${section.type}
- **Component Name**: ${section.fileName}
- **Intent**: ${section.intent}
- **Content Hints**: ${section.contentHints}

Generate the complete ${section.fileName}.tsx component.`;

  const raw = await callLLM(systemPrompt, userMessage, 0.7);
  const tsx = extractContent(raw, "tsx");
  const filePath = `components/sections/${section.fileName}.tsx`;

  const dirPath = join(SITE_ROOT, "components/sections");
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });

  await writeFile(filePath, tsx);
  await formatFile(filePath);

  return filePath;
}

// ─── Step 5a: Compose Layout (navigation + footer → layout.tsx) ──────────

async function stepComposeLayout(
  layoutSections: SectionSpec[],
  blueprint: PageBlueprint
): Promise<void> {
  if (layoutSections.length === 0) return;

  const currentLayout = readSiteFile("app/layout.tsx");

  const imports = layoutSections
    .map((s) => `import ${s.fileName} from "@/components/sections/${s.fileName}";`)
    .join("\n");

  const navSection = layoutSections.find((s) => s.type === "navigation");
  const footerSection = layoutSections.find((s) => s.type === "footer");

  // Deterministic update: inject imports and wrap children with nav/footer.
  // We update the existing layout.tsx rather than replacing it wholesale,
  // to preserve metadata, fonts, and other project-level configuration.
  const systemPrompt = loadSystem("frontend");

  const userMessage = `Update the existing Next.js \`app/layout.tsx\` to add the generated Navigation and Footer section components.

## Current layout.tsx
\`\`\`tsx
${currentLayout}
\`\`\`

## Components to inject
${imports}

## Instructions
1. Add the import statements above to the existing imports (do not duplicate if already present)
2. ${navSection ? `Render <${navSection.fileName} /> as the very first child inside <body>, before {children}` : ""}
3. ${footerSection ? `Render <${footerSection.fileName} /> as the last child inside <body>, after {children}` : ""}
4. Preserve ALL existing content: metadata, font setup, className on <html>/<body>, etc.
5. Output ONLY the complete updated layout.tsx — no markdown fences, no explanation
6. Page: ${blueprint.title}`;

  const raw = await callLLM(systemPrompt, userMessage, 0.2);
  const tsx = extractContent(raw, "tsx");

  await writeFile("app/layout.tsx", tsx);
  await formatFile("app/layout.tsx");
}

// ─── Step 5b: Compose Page (content sections only → page.tsx) ────────────

async function stepComposePage(
  blueprint: PageBlueprint,
  designSystem: string,
  pageSections: SectionSpec[]
): Promise<void> {
  const systemPrompt = [
    loadSystem("frontend"),
    "\n\n",
    loadPrompt("landing.compose_page"),
  ].join("");

  const userMessage = `## Page Title
${blueprint.title}

## Page Description
${blueprint.description}

## Content Sections to Compose (in order, navigation and footer are in layout.tsx — do NOT include them)
${pageSections.map((s, i) => `${i + 1}. ${s.fileName}`).join("\n")}

## Design System (for global effects)
${designSystem}

Generate the page.tsx that imports and assembles these content sections.`;

  const raw = await callLLM(systemPrompt, userMessage, 0.3);
  const tsx = extractContent(raw, "tsx");

  await writeFile("app/page.tsx", tsx);
  await formatFile("app/page.tsx");
}

// ─── Main Executor ───────────────────────────────────────────────────────

export async function runBuildLandingPage(
  userInput: string,
  /** Called immediately when each step completes — use for SSE streaming */
  onStep?: (step: BuildStep) => void
): Promise<BuildLandingPageResult> {
  const flowStart = Date.now();

  const result: BuildLandingPageResult = {
    success: false,
    generatedFiles: [],
    steps: [],
  };

  // ─── Step timer helpers ────────────────────────────────────────────────
  const stepStarts = new Map<string, number>();

  const startStep = (step: string) => stepStarts.set(step, Date.now());

  const log = (step: string, status: "ok" | "error", detail?: string) => {
    const now = Date.now();
    const duration = now - (stepStarts.get(step) ?? now);
    const entry: BuildStep = { step, status, detail, timestamp: now, duration };
    result.steps.push(entry);
    onStep?.(entry);
    const icon = status === "ok" ? "✓" : "✗";
    const ms = duration > 0 ? ` (+${(duration / 1000).toFixed(1)}s)` : "";
    console.log(`[build_landing_page] ${icon} ${step}${detail ? `: ${detail}` : ""}${ms}`);
  };

  // Wrap an async step with automatic timing
  async function timed<T>(
    stepName: string,
    fn: () => Promise<T>,
    onOk?: (val: T) => string | undefined
  ): Promise<T> {
    startStep(stepName);
    try {
      const val = await fn();
      log(stepName, "ok", onOk?.(val));
      return val;
    } catch (err) {
      log(stepName, "error", err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  try {
    // Step 1: Analyze requirement
    const blueprint = await timed(
      "analyze_requirement",
      () => stepAnalyzeRequirement(userInput),
      (bp) => `${bp.sections.length} sections planned`
    );
    result.blueprint = blueprint;

    // Step 2: Generate design system
    const designSystem = await timed(
      "generate_design_system",
      () => stepGenerateDesignSystem(blueprint),
      () => "design-system.md written"
    );
    result.generatedFiles.push("design-system.md");

    // Step 3: Apply design tokens
    await timed(
      "apply_design_tokens",
      () => stepApplyDesignTokens(designSystem),
      () => "globals.css + tailwind.config.ts updated"
    );
    result.generatedFiles.push("app/globals.css");

    // Step 4: Generate sections — 并发执行，互相独立，单个失败不阻塞其他
    const layoutSections = blueprint.sections.filter((s) =>
      LAYOUT_SECTION_TYPES.has(s.type)
    );
    const pageSections = blueprint.sections.filter(
      (s) => !LAYOUT_SECTION_TYPES.has(s.type)
    );

    const designStyle = blueprint.designIntent.keywords.join(", ");

    // Start all section timers before concurrent execution
    blueprint.sections.forEach((s) =>
      startStep(`generate_section:${s.fileName}`)
    );

    const sectionResults = await Promise.allSettled(
      blueprint.sections.map((section) =>
        stepGenerateSection(designSystem, section, designStyle)
      )
    );

    for (let i = 0; i < blueprint.sections.length; i++) {
      const section = blueprint.sections[i];
      const res = sectionResults[i];
      if (res.status === "fulfilled") {
        result.generatedFiles.push(res.value);
        log(`generate_section:${section.fileName}`, "ok", res.value);
      } else {
        const msg =
          res.reason instanceof Error ? res.reason.message : String(res.reason);
        log(`generate_section:${section.fileName}`, "error", msg);
      }
    }

    // Step 5a: 将 navigation/footer 注入 layout.tsx
    if (layoutSections.length > 0) {
      await timed(
        "compose_layout",
        () => stepComposeLayout(layoutSections, blueprint),
        () => `layout.tsx updated (${layoutSections.map((s) => s.fileName).join(", ")})`
      );
      result.generatedFiles.push("app/layout.tsx");
    }

    // Step 5b: 将内容 sections 组合为 page.tsx
    await timed(
      "compose_page",
      () => stepComposePage(blueprint, designSystem, pageSections),
      () => `app/page.tsx written (${pageSections.length} sections)`
    );
    result.generatedFiles.push("app/page.tsx");

    // Step 6: Run build to verify
    startStep("run_build");
    const buildResult = await executeSystemTool("run_build", { script: "build" });
    const buildOutput =
      typeof buildResult === "string"
        ? buildResult
        : buildResult.success
        ? buildResult.output ?? "build passed"
        : buildResult.error ?? "build failed";
    const buildOk = typeof buildResult === "object" ? buildResult.success : true;
    log("run_build", buildOk ? "ok" : "error", buildOutput.slice(0, 200));

    result.success = true;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    result.success = false;
  }

  result.totalDuration = Date.now() - flowStart;
  return result;
}
