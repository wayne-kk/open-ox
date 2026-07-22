import { describe, expect, it, vi } from "vitest";
import { createDesignSystemResolver } from "./resolveDesignSystem";
import { resolveDesignSystem } from "./productionResolver";
import { createFileDesignSystemSkillCatalog } from "./catalog";
import { validateDesignSystemContract } from "./validator";
import type { DesignSystemSkill } from "./types";

const VALID_DESIGN_SYSTEM = `# Minimal Dark Design System

## 1. Design Philosophy
Atmospheric depth with restrained amber accents.

## Visual Contract (agent)

### Color roles
- background: #0a0a0f
- foreground: #fafafa
- primary: #f59e0b
- muted: #1a1a24
- accent: #f59e0b
- card: #12121a

### Font roles
- **Display**: Space Grotesk
- **Header**: Space Grotesk
- **Body**: Inter

### Bold Factor (max 5)
1. Display headings may reach md:text-6xl.

### Hero
Use a spacious split composition.

### Surfaces
Layer deep slate surfaces with subtle borders.

## 2. Design Token System (The DNA)
--color-background: #0a0a0f
--color-foreground: #fafafa
--color-primary: #f59e0b
--color-primary-foreground: #0a0a0f
--color-secondary: #18181f
--color-secondary-foreground: #fafafa
--color-accent: #f59e0b
--color-accent-foreground: #0a0a0f
--color-muted: #1a1a24
--color-muted-foreground: #a1a1aa
--color-destructive: #ef4444
--color-destructive-foreground: #fafafa
--color-card: #12121a
--color-card-foreground: #fafafa
--color-popover: #12121a
--color-popover-foreground: #fafafa
--color-border: #2a2a35
--color-input: #1a1a24
--color-ring: #f59e0b

## 3. Component Stylings

### Buttons
Buttons use the token roles above.

### Cards
Cards use the token roles above.

### Inputs
Inputs use the token roles above.

## 4. Layout System
Use a twelve-column desktop grid.

## 5. Anti-Generic Enforcement (The Bold Factor)
1. Use amber only for focal actions.

## 6. Effects & Animation
Use 180ms ease-out transitions.

## 7. Iconography
Use lucide-react.

## 8. Accessibility
Maintain WCAG AA contrast.
`;

function skill(overrides: Partial<DesignSystemSkill> = {}): DesignSystemSkill {
  return {
    metadata: {
      id: "minimal-dark",
      version: "2",
      contractVersion: 1,
      status: "active",
      aliases: ["minimal dark"],
      positiveSignals: {
        moods: ["calm", "premium"],
        colors: ["dark", "amber"],
        productTypes: ["developer-tool"],
      },
      negativeSignals: {
        moods: ["playful"],
        colors: ["pastel"],
        productTypes: ["children"],
      },
      supportedModes: ["marketing", "web-app"],
    },
    content: VALID_DESIGN_SYSTEM,
    ...overrides,
  };
}

describe("DesignSystemResolver", () => {
  it("loads exactly the five approved catalog skills", () => {
    expect(
      createFileDesignSystemSkillCatalog()
        .list()
        .map((item) => item.metadata.id)
        .sort(),
    ).toEqual([
      "bauhaus",
      "luxury",
      "minimal-dark",
      "neo-brutalism",
      "newsprint",
    ]);
  });

  it.each(["minimal-dark", "newsprint", "bauhaus", "neo-brutalism", "luxury"])(
    "ships %s as a contract-valid explicit fast-path skill",
    async (skillId) => {
      const result = await resolveDesignSystem({
        userInput: `Use ${skillId}`,
        designIntentMarkdown: `Style: ${skillId}`,
        selectedSkill: { id: skillId, version: "2" },
      });

      expect(result).toMatchObject({
        source: "skill",
        skillId,
        skillVersion: "2",
        reason: "explicit_selection",
      });
    },
  );

  it("uses an explicitly selected eligible skill without invoking either LLM path", async () => {
    const selected = skill();
    const judge = vi.fn();
    const generate = vi.fn();
    const resolver = createDesignSystemResolver({
      catalog: {
        list: () => [selected],
        get: (id) => (id === selected.metadata.id ? selected : null),
      },
      judge,
      generate,
    });

    const result = await resolver.resolve({
      userInput: "Build a premium dark developer tool",
      designIntentMarkdown: "Mood: calm premium. Colors: dark with amber.",
      projectType: "developer-tool",
      screenshotMode: "none",
      selectedSkill: { id: "minimal-dark", version: "2" },
    });

    expect(result).toMatchObject({
      source: "skill",
      skillId: "minimal-dark",
      skillVersion: "2",
      confidence: 1,
      reason: "explicit_selection",
    });
    expect(result.designSystem).toBe(VALID_DESIGN_SYSTEM);
    expect(judge).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it("lets the kill switch override an explicit selection", async () => {
    const selected = skill();
    const generate = vi
      .fn()
      .mockResolvedValue({ designSystem: "# Generated while disabled" });
    const resolver = createDesignSystemResolver({
      catalog: { list: () => [selected], get: () => selected },
      judge: vi.fn(),
      generate,
    });

    const result = await resolver.resolve({
      userInput: "Use minimal dark",
      designIntentMarkdown: "Style: minimal dark",
      selectedSkill: { id: "minimal-dark", version: "2" },
      matchingEnabled: false,
    });

    expect(result).toMatchObject({
      source: "generated",
      fallbackReason: "matching_disabled",
    });
    expect(generate).toHaveBeenCalledOnce();
  });

  it("requires an explicit selection to include the exact version", async () => {
    const selected = skill();
    const resolver = createDesignSystemResolver({
      catalog: { list: () => [selected], get: () => selected },
      judge: vi.fn(),
      generate: vi
        .fn()
        .mockResolvedValue({ designSystem: "# Generated for invalid selection" }),
    });

    const result = await resolver.resolve({
      userInput: "Use minimal dark",
      designIntentMarkdown: "Style: minimal dark",
      selectedSkill: { id: "minimal-dark" } as never,
    });

    expect(result).toMatchObject({
      source: "generated",
      fallbackReason: "skill_invalid",
    });
  });

  it("honors an explicit versioned skill during screenshot replication", async () => {
    const selected = skill();
    const generate = vi.fn();
    const resolver = createDesignSystemResolver({
      catalog: { list: () => [selected], get: () => selected },
      judge: vi.fn(),
      generate,
    });

    const result = await resolver.resolve({
      userInput: "Replicate this screenshot with minimal dark",
      designIntentMarkdown: "Style: minimal dark",
      screenshotMode: "replicate_layout",
      selectedSkill: { id: "minimal-dark", version: "2" },
    });

    expect(result).toMatchObject({
      source: "skill",
      reason: "explicit_selection",
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("falls back to generation when an explicitly selected skill fails the current contract", async () => {
    const selected = skill({
      content: "# Legacy skill without the required token contract",
    });
    const generate = vi
      .fn()
      .mockResolvedValue({ designSystem: "# Generated design system" });
    const resolver = createDesignSystemResolver({
      catalog: {
        list: () => [selected],
        get: () => selected,
      },
      judge: vi.fn(),
      generate,
    });
    const request = {
      userInput: "Build a premium dark developer tool",
      designIntentMarkdown: "Mood: calm premium.",
      selectedSkill: { id: "minimal-dark", version: "2" },
      legacyStyleGuide: "Prefer warm amber accents",
    };

    const result = await resolver.resolve(request);

    expect(result).toMatchObject({
      source: "generated",
      designSystem: "# Generated design system",
      fallbackReason: "skill_invalid",
    });
    expect(generate).toHaveBeenCalledOnce();
    expect(generate).toHaveBeenCalledWith(request);
  });

  it("uses a high-confidence automatic match and skips design-system generation", async () => {
    const candidate = skill();
    const judge = vi.fn().mockResolvedValue({
      decision: {
        skillId: "minimal-dark",
        confidence: 0.92,
        evidence: ["premium dark", "amber", "developer-tool"],
        conflicts: [],
        reason: "Strong fit for the requested visual direction",
      },
    });
    const generate = vi.fn();
    const resolver = createDesignSystemResolver({
      catalog: {
        list: () => [candidate],
        get: (id) => (id === candidate.metadata.id ? candidate : null),
      },
      judge,
      generate,
    });
    const request = {
      userInput: "Build a premium dark developer tool with amber highlights",
      designIntentMarkdown:
        "Mood: calm premium. Colors: dark charcoal and amber.",
      projectType: "developer-tool",
      surfaceMode: "web-app" as const,
      screenshotMode: "none" as const,
    };

    const result = await resolver.resolve(request);

    expect(result).toMatchObject({
      source: "skill",
      skillId: "minimal-dark",
      confidence: 0.92,
      reason: "automatic_match",
    });
    expect(judge).toHaveBeenCalledOnce();
    expect(judge.mock.calls[0]?.[1]).toEqual([
      expect.objectContaining({ skillId: "minimal-dark", conflicts: [] }),
    ]);
    expect(generate).not.toHaveBeenCalled();
  });

  it("infers web-app mode from project type and excludes marketing-only skills", async () => {
    const webApp = skill();
    const marketingOnly = skill({
      metadata: {
        ...webApp.metadata,
        id: "luxury",
        aliases: ["quiet luxury"],
        supportedModes: ["marketing"],
      },
    });
    const judge = vi.fn().mockResolvedValue({
      decision: {
        skillId: "minimal-dark",
        confidence: 0.95,
        evidence: ["developer dashboard"],
        conflicts: [],
        reason: "Fits the application surface",
      },
    });
    const resolver = createDesignSystemResolver({
      catalog: {
        list: () => [webApp, marketingOnly],
        get: (id) => (id === webApp.metadata.id ? webApp : marketingOnly),
      },
      judge,
      generate: vi.fn(),
    });

    await resolver.resolve({
      userInput: "A minimal dark quiet luxury developer dashboard",
      designIntentMarkdown: "minimal dark and quiet luxury",
      projectType: "developer dashboard",
    });

    expect(judge).toHaveBeenCalledWith(
      expect.objectContaining({ surfaceMode: "web-app" }),
      [expect.objectContaining({ skillId: "minimal-dark" })],
    );
  });

  it("generates a bespoke design system when the automatic match is below the confidence gate", async () => {
    const candidate = skill();
    const generate = vi
      .fn()
      .mockResolvedValue({ designSystem: "# Bespoke design system" });
    const resolver = createDesignSystemResolver({
      catalog: {
        list: () => [candidate],
        get: () => candidate,
      },
      judge: vi.fn().mockResolvedValue({
        decision: {
          skillId: "minimal-dark",
          confidence: 0.7,
          evidence: ["dark"],
          conflicts: [],
          reason: "The request is not specific enough",
        },
      }),
      generate,
    });

    const result = await resolver.resolve({
      userInput: "A minimal dark website",
      designIntentMarkdown: "Colors: dark charcoal",
    });

    expect(result).toMatchObject({
      source: "generated",
      designSystem: "# Bespoke design system",
      fallbackReason: "low_confidence",
    });
    expect(generate).toHaveBeenCalledOnce();
  });

  it("does not auto-match a skill during screenshot layout replication", async () => {
    const candidate = skill();
    const judge = vi.fn();
    const generate = vi
      .fn()
      .mockResolvedValue({ designSystem: "# Screenshot-led design system" });
    const resolver = createDesignSystemResolver({
      catalog: { list: () => [candidate], get: () => candidate },
      judge,
      generate,
    });

    const result = await resolver.resolve({
      userInput: "Replicate this screenshot in a minimal dark style",
      designIntentMarkdown: "Style: minimal dark",
      screenshotMode: "replicate_layout",
    });

    expect(result).toMatchObject({
      source: "generated",
      fallbackReason: "screenshot_replica",
    });
    expect(judge).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalledOnce();
  });

  it("uses semantic judging to confirm a deterministic negative-signal hit", async () => {
    const candidate = skill();
    const judge = vi.fn().mockResolvedValue({
      decision: {
        skillId: "minimal-dark",
        confidence: 0.91,
        evidence: ["minimal dark"],
        conflicts: ["User explicitly requested a playful mood"],
        reason: "The requested mood conflicts with the skill",
      },
    });
    const generate = vi
      .fn()
      .mockResolvedValue({ designSystem: "# Playful bespoke system" });
    const resolver = createDesignSystemResolver({
      catalog: { list: () => [candidate], get: () => candidate },
      judge,
      generate,
    });

    const result = await resolver.resolve({
      userInput: "Make a playful minimal dark experience",
      designIntentMarkdown: "Mood: playful",
    });

    expect(result).toMatchObject({
      source: "generated",
      fallbackReason: "explicit_conflict",
      trace: {
        candidates: [
          expect.objectContaining({
            skillId: "minimal-dark",
            conflicts: ["moods:playful"],
          }),
        ],
      },
    });
    expect(judge).toHaveBeenCalledOnce();
  });

  it("does not treat a negated exclusion as a hard conflict before judging", async () => {
    const candidate = skill();
    const judge = vi.fn().mockResolvedValue({
      decision: {
        skillId: "minimal-dark",
        confidence: 0.94,
        evidence: ["minimal dark", "explicitly avoids pastel"],
        conflicts: [],
        reason: "The exclusion is negated and therefore compatible",
      },
    });
    const resolver = createDesignSystemResolver({
      catalog: { list: () => [candidate], get: () => candidate },
      judge,
      generate: vi.fn(),
    });

    const result = await resolver.resolve({
      userInput: "Use minimal dark and avoid pastel colors",
      designIntentMarkdown: "Style: minimal dark; forbidden: pastel",
    });

    expect(result).toMatchObject({ source: "skill", skillId: "minimal-dark" });
    expect(judge).toHaveBeenCalledWith(
      expect.anything(),
      [
        expect.objectContaining({
          skillId: "minimal-dark",
          conflicts: ["colors:pastel"],
        }),
      ],
    );
  });

  it("falls back when two candidates remain too close after semantic judging", async () => {
    const minimalDark = skill();
    const luxury = skill({
      metadata: {
        ...minimalDark.metadata,
        id: "luxury",
        aliases: ["quiet luxury"],
      },
    });
    const generate = vi
      .fn()
      .mockResolvedValue({ designSystem: "# Bespoke hybrid" });
    const resolver = createDesignSystemResolver({
      catalog: {
        list: () => [minimalDark, luxury],
        get: (id) =>
          id === "minimal-dark" ? minimalDark : id === "luxury" ? luxury : null,
      },
      judge: vi.fn().mockResolvedValue({
        decision: {
          skillId: "minimal-dark",
          confidence: 0.93,
          evidence: ["minimal dark"],
          conflicts: [],
          reason: "Slight preference for minimal dark",
        },
      }),
      generate,
    });

    const result = await resolver.resolve({
      userInput: "Blend minimal dark with quiet luxury",
      designIntentMarkdown: "Style: minimal dark, quiet luxury",
    });

    expect(result).toMatchObject({
      source: "generated",
      fallbackReason: "ambiguous",
    });
    expect(generate).toHaveBeenCalledOnce();
  });

  it.each([
    [
      "invalid hex token",
      VALID_DESIGN_SYSTEM.replace(
        "--color-background: #0a0a0f",
        "--color-background: rgb(10 10 15)",
      ),
    ],
    ["pure white background", VALID_DESIGN_SYSTEM.replaceAll("#0a0a0f", "#ffffff")],
    ["Tailwind theme function", `${VALID_DESIGN_SYSTEM}\ncolor: theme(--color-primary);`],
    ["Tailwind v3 directive", `${VALID_DESIGN_SYSTEM}\n@tailwind utilities;`],
    ["forbidden spacing token", `${VALID_DESIGN_SYSTEM}\n--spacing-xl: 4rem;`],
    ["extra font role", `${VALID_DESIGN_SYSTEM}\n--font-label: Inter;`],
    ["clip path", `${VALID_DESIGN_SYSTEM}\nclip-path: polygon(0 0, 100% 0, 100% 100%);`],
  ])("rejects %s in the design-system contract", (_label, content) => {
    expect(validateDesignSystemContract(content, 1).valid).toBe(false);
  });
});
