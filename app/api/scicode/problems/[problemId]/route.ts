import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type Params = { params: Promise<{ problemId: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { problemId } = await params;
    const [problemRes, subStepsRes] = await Promise.all([
      supabase.from("scicode_problems").select("*").eq("problem_id", problemId).single(),
      supabase
        .from("scicode_sub_steps")
        .select("id,step_number,step_key,step_order,step_description_prompt,function_header,test_cases,return_line")
        .eq("problem_id", problemId)
        .order("step_order", { ascending: true }),
    ]);
    if (problemRes.error) {
      if (problemRes.error.code === "PGRST116") {
        return NextResponse.json({ error: "Problem not found" }, { status: 404 });
      }
      throw new Error(problemRes.error.message);
    }
    if (subStepsRes.error) throw new Error(subStepsRes.error.message);
    return NextResponse.json({ problem: problemRes.data, sub_steps: subStepsRes.data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

