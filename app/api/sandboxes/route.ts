import { NextResponse } from "next/server";
import { Sandbox } from "e2b";
import { getSessionUser } from "@/lib/auth/session";

const apiKey = process.env.E2B_API_KEY;

async function listAllSandboxes() {
  if (!apiKey) throw new Error("E2B_API_KEY not set");
  const paginator = Sandbox.list({ apiKey });
  const all: Awaited<ReturnType<typeof paginator.nextItems>> = [];
  while (paginator.hasNext) {
    const items = await paginator.nextItems();
    all.push(...items);
  }
  return all;
}

/** GET /api/sandboxes — list all running E2B sandboxes */
export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!apiKey) return NextResponse.json({ error: "E2B_API_KEY not set" }, { status: 500 });
  try {
    const sandboxes = await listAllSandboxes();
    const list = sandboxes.map((info) => ({
      sandboxId: info.sandboxId,
      startedAt: info.startedAt?.toISOString(),
      metadata: info.metadata,
    }));
    return NextResponse.json(list);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE /api/sandboxes — kill ALL running E2B sandboxes and clear DB references */
export async function DELETE() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!apiKey) return NextResponse.json({ error: "E2B_API_KEY not set" }, { status: 500 });
  try {
    const sandboxes = await listAllSandboxes();
    const killed: string[] = [];
    for (const info of sandboxes) {
      await Sandbox.kill(info.sandboxId, { apiKey });
      killed.push(info.sandboxId);
    }
    await session.supabase
      .from("projects")
      .update({ sandbox_id: null })
      .eq("user_id", session.user.id)
      .neq("sandbox_id", "");
    return NextResponse.json({ killed, count: killed.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
