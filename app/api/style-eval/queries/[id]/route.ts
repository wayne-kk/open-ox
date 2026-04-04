/**
 * /api/style-eval/queries/[id]
 * DELETE — 删除 query
 */

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const TABLE = "style_eval_queries";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
