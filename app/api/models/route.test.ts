import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { requireAdmin, createSupabaseServiceRoleClient } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/admin/requireAdmin", () => ({ requireAdmin }));
vi.mock("@/lib/supabase/service-role", () => ({ createSupabaseServiceRoleClient }));

import { DELETE, GET, POST, PUT } from "./route";

describe("POST /api/models", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      name: "PUT",
      handler: PUT,
      body: { stepName: "page_implement_agent", modelId: "gemini-3.5-flash" },
    },
    { name: "DELETE", handler: DELETE, body: { id: "gemini-3.5-flash" } },
  ])("rejects non-admin $name requests before database access", async ({ handler, body }) => {
    requireAdmin.mockResolvedValue({
      error: NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 }),
    });

    const response = await handler(
      new NextRequest("http://localhost/api/models", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(403);
    expect(createSupabaseServiceRoleClient).not.toHaveBeenCalled();
  });

  it("keeps model configuration readable without an admin check", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const from = vi.fn((table: string) => ({
      select: vi.fn().mockReturnValue(
        table === "model_configs"
          ? { order }
          : Promise.resolve({ data: [], error: null }),
      ),
    }));
    createSupabaseServiceRoleClient.mockReturnValue({ from });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(requireAdmin).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith("model_configs");
    expect(from).toHaveBeenCalledWith("step_model_configs");
  });

  it("rejects non-admin requests before creating a service-role client", async () => {
    requireAdmin.mockResolvedValue({
      error: NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 }),
    });

    const response = await POST(
      new NextRequest("http://localhost/api/models", {
        method: "POST",
        body: JSON.stringify({ id: "test-model", displayName: "Test model" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(403);
    expect(createSupabaseServiceRoleClient).not.toHaveBeenCalled();
  });

  it("uses the service-role client for an admin model upsert", async () => {
    requireAdmin.mockResolvedValue({ user: { id: "admin-user" } });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upsert });
    createSupabaseServiceRoleClient.mockReturnValue({ from });

    const response = await POST(
      new NextRequest("http://localhost/api/models", {
        method: "POST",
        body: JSON.stringify({
          id: "test-model",
          displayName: "Test model",
          contextWindow: 128_000,
          supportsThinking: true,
          tokenPrice: { inputPerMTok: 2, outputPerMTok: 8 },
        }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledWith("model_configs");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "test-model",
        display_name: "Test model",
        context_window: 128_000,
        supports_thinking: true,
        input_price_per_mtok: 2,
        output_price_per_mtok: 8,
      }),
    );
  });

  it("uses the service-role client for an admin step assignment", async () => {
    requireAdmin.mockResolvedValue({ user: { id: "admin-user" } });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upsert });
    createSupabaseServiceRoleClient.mockReturnValue({ from });

    const response = await PUT(
      new NextRequest("http://localhost/api/models", {
        method: "PUT",
        body: JSON.stringify({
          stepName: "page_implement_agent",
          modelId: "gemini-3.5-flash",
          thinkingLevel: "low",
        }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledWith("step_model_configs");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        step_name: "page_implement_agent",
        model_id: "gemini-3.5-flash",
        thinking_level: "low",
      }),
    );
  });

  it("uses the service-role client for an admin model deletion", async () => {
    requireAdmin.mockResolvedValue({ user: { id: "admin-user" } });
    const assignmentEq = vi.fn().mockResolvedValue({ error: null });
    const modelEq = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) => ({
      delete: vi.fn().mockReturnValue({
        eq: table === "step_model_configs" ? assignmentEq : modelEq,
      }),
    }));
    createSupabaseServiceRoleClient.mockReturnValue({ from });

    const response = await DELETE(
      new NextRequest("http://localhost/api/models", {
        method: "DELETE",
        body: JSON.stringify({ id: "gemini-3.5-flash" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(from).toHaveBeenNthCalledWith(1, "step_model_configs");
    expect(assignmentEq).toHaveBeenCalledWith("model_id", "gemini-3.5-flash");
    expect(from).toHaveBeenCalledWith("model_configs");
    expect(modelEq).toHaveBeenCalledWith("id", "gemini-3.5-flash");
  });
});
