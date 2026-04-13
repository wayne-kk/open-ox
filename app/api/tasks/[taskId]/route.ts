import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type Params = { params: Promise<{ taskId: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { taskId } = await params;
    const result = await supabase
      .from("task_specs")
      .select("*")
      .eq("task_id", taskId)
      .single();

    if (result.error) {
      if (result.error.code === "PGRST116") {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }
      throw new Error(result.error.message);
    }
    return NextResponse.json({ task: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

