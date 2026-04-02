import { NextResponse } from "next/server";
import { Sandbox } from "e2b";
import { supabase } from "@/lib/supabase";

const apiKey = process.env.E2B_API_KEY;

/** GET /api/sandboxes — list all running E2B sandboxes */
export async function GET() {
  if (!apiKey) return NextResponse.json({ error: "E2B_API_KEY not set" }, { status: 500 });
  try {
    const list: Array<{ sandboxId: string; startedAt?: string; metadata?: Record<string, string> }> = [];
    for await (const info of Sandbox.list({ apiKey })) {
      list.push({
        sandboxId: info.sandboxId,
        startedAt: info.startedAt?.toISOString(),
        metadata: info.metadata,
      });
    }
    return NextResponse.json(list);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE /api/sandboxes — kill ALL running E2B sandboxes and clear DB references */
export async function DELETE() {
  if (!apiKey) return NextResponse.json({ error: "E2B_API_KEY not set" }, { status: 500 });
  try {
    const killed: string[] = [];
    for await (const info of Sandbox.list({ apiKey })) {
      await Sandbox.kill(info.sandboxId, { apiKey });
      killed.push(info.sandboxId);
    }
    // Clear all sandbox_id references in Supabase
    await supabase.from("projects").update({ sandbox_id: null }).neq("sandbox_id", "");
    return NextResponse.json({ killed, count: killed.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
