import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModifySSEEvent } from "@/ai/flows/modify_project/runModifyProject";
import type { AccumulatedUsage } from "@/lib/billing/usageContext";
import {
  runHeadlessModifyTurn,
  type HeadlessModifyTurnDeps,
} from "./runHeadlessModifyTurn";

const emptyUsage: AccumulatedUsage = {
  events: [],
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalUsd: 0,
  totalCredits: 0,
};

function makeDeps(overrides: Partial<HeadlessModifyTurnDeps> = {}): HeadlessModifyTurnDeps {
  const held = new Set<string>();
  return {
    tryAcquire: (id) => {
      if (held.has(id)) return false;
      held.add(id);
      return true;
    },
    release: (id) => {
      held.delete(id);
    },
    creditsEnabled: () => true,
    canAfford: async () => ({ ok: true, balance: 12 }),
    minModifyCredits: 0.5,
    getProject: async () =>
      ({
        id: "p1",
        modificationHistory: [
          {
            instruction: "make hero quieter",
            modifiedAt: new Date().toISOString(),
            touchedFiles: ["app/page.tsx"],
            intentCategory: "code_change" as const,
            plan: { analysis: "Hero contrast reduced.", changes: [] },
          },
        ],
      }) as never,
    runModify: async (_db, _id, _instruction, onEvent: (e: ModifySSEEvent) => void) => {
      onEvent({ type: "intent", category: "code_change", label: "修改" });
      onEvent({
        type: "plan",
        intentCategory: "code_change",
        plan: { analysis: "Hero contrast reduced.", changes: [] },
      });
      onEvent({
        type: "diff",
        file: "app/page.tsx",
        reasoning: "tone down",
        patch: "",
        stats: { additions: 1, deletions: 1 },
      });
    },
    runWithUsage: async (fn) => {
      await fn();
      return { result: undefined, usage: { ...emptyUsage, totalCredits: 1.2, totalUsd: 0.012 } };
    },
    charge: async () => ({ charged: 1.2, balance: 10.8 }),
    ...overrides,
  };
}

const db = {} as SupabaseClient;

describe("runHeadlessModifyTurn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("leaves the model unset so the configured Modify model can apply", async () => {
    const runModify = vi.fn(
      async (
        _db: SupabaseClient,
        _id: string,
        _instruction: string,
        onEvent: (e: ModifySSEEvent) => void,
        history: unknown,
        clearContext: boolean,
        image: unknown,
        model: string | undefined
      ) => {
        expect(history).toBeUndefined();
        expect(clearContext).toBe(false);
        expect(image).toBeUndefined();
        expect(model).toBeUndefined();
        onEvent({
          type: "plan",
          intentCategory: "code_change",
          plan: { analysis: "Hero contrast reduced.", changes: [] },
        });
        onEvent({
          type: "diff",
          file: "app/page.tsx",
          reasoning: "x",
          patch: "",
          stats: { additions: 1, deletions: 0 },
        });
      }
    );

    const result = await runHeadlessModifyTurn(
      db,
      { userId: "u1", projectId: "p1", instruction: "make hero quieter" },
      makeDeps({ runModify: runModify as never })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.assistantText).toContain("Hero contrast");
    expect(result.touchedFiles).toEqual(["app/page.tsx"]);
    expect(result.charged).toBe(1.2);
    expect(result.balanceAfter).toBe(10.8);
    expect(runModify).toHaveBeenCalledOnce();
  });

  it("rejects when project modify is already in flight (no charge)", async () => {
    const charge = vi.fn(async () => ({ charged: 1, balance: 0 }));
    const runModify = vi.fn();
    const deps = makeDeps({
      tryAcquire: () => false,
      charge,
      runModify: runModify as never,
    });

    const result = await runHeadlessModifyTurn(
      db,
      { userId: "u1", projectId: "p1", instruction: "x" },
      deps
    );

    expect(result).toEqual({
      ok: false,
      code: "MODIFY_IN_FLIGHT",
      message: expect.stringContaining("in progress"),
    });
    expect(runModify).not.toHaveBeenCalled();
    expect(charge).not.toHaveBeenCalled();
  });

  it("rejects insufficient credits before running modify", async () => {
    const runModify = vi.fn();
    const charge = vi.fn();
    const result = await runHeadlessModifyTurn(
      db,
      { userId: "u1", projectId: "p1", instruction: "x" },
      makeDeps({
        canAfford: async () => ({ ok: false, balance: 0.1 }),
        runModify: runModify as never,
        charge: charge as never,
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INSUFFICIENT_CREDITS");
    expect(result.balance).toBe(0.1);
    expect(result.required).toBe(0.5);
    expect(runModify).not.toHaveBeenCalled();
    expect(charge).not.toHaveBeenCalled();
  });

  it("skips credit gate when credits are disabled", async () => {
    const canAfford = vi.fn();
    const result = await runHeadlessModifyTurn(
      db,
      { userId: "u1", projectId: "p1", instruction: "make hero quieter" },
      makeDeps({
        creditsEnabled: () => false,
        canAfford: canAfford as never,
      })
    );

    expect(result.ok).toBe(true);
    expect(canAfford).not.toHaveBeenCalled();
  });

  it("releases the lock after insufficient credits so a later turn can start", async () => {
    const held = new Set<string>();
    const deps = makeDeps({
      tryAcquire: (id) => {
        if (held.has(id)) return false;
        held.add(id);
        return true;
      },
      release: (id) => {
        held.delete(id);
      },
      canAfford: async () => ({ ok: false, balance: 0 }),
    });

    await runHeadlessModifyTurn(db, { userId: "u1", projectId: "p1", instruction: "x" }, deps);
    expect(held.has("p1")).toBe(false);
    expect(deps.tryAcquire("p1")).toBe(true);
  });
});
