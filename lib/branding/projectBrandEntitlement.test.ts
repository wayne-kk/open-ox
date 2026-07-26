import { describe, expect, it, vi } from "vitest";

import {
  BRAND_REMOVAL_PRICE_CREDITS,
  purchaseProjectBrandRemoval,
} from "./projectBrandEntitlement";

describe("project brand removal purchase", () => {
  it("requests one atomic 80-credit project purchase and returns the durable entitlement", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ charged: 80, balance: 25, purchased: true }],
      error: null,
    });

    const result = await purchaseProjectBrandRemoval({ rpc } as never, {
      projectId: "project-1",
      userId: "user-1",
      idempotencyKey: "purchase-1",
    });

    expect(BRAND_REMOVAL_PRICE_CREDITS).toBe(80);
    expect(rpc).toHaveBeenCalledWith("purchase_project_brand_removal", {
      target_project_id: "project-1",
      target_user_id: "user-1",
      purchase_idempotency_key: "purchase-1",
      price_credits: 80,
    });
    expect(result).toEqual({
      ok: true,
      charged: 80,
      balance: 25,
      purchased: true,
    });
  });

  it("does not treat an insufficient balance as a partial purchase", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "INSUFFICIENT_CREDITS", details: "balance=20" },
    });

    const result = await purchaseProjectBrandRemoval({ rpc } as never, {
      projectId: "project-1",
      userId: "user-1",
      idempotencyKey: "purchase-2",
    });

    expect(result).toEqual({
      ok: false,
      code: "INSUFFICIENT_CREDITS",
      message: "Insufficient credits",
    });
  });
});
