import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type Params = { params: Promise<{ problemId: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const { problemId } = await params;
    const [problemRes, subStepsRes] = await Promise.all([
      supabase.from("scicode_problems").select("problem_id,general_tests").eq("problem_id", problemId).single(),
      supabase
        .from("scicode_sub_steps")
        .select("step_key,test_cases,function_header,return_line")
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

    const stepRows = subStepsRes.data ?? [];
    const generalTests = Array.isArray(problemRes.data.general_tests) ? problemRes.data.general_tests : [];
    const stepChecks = stepRows.map((step) => {
      const tests = Array.isArray(step.test_cases) ? step.test_cases : [];
      const functionHeaderValid = typeof step.function_header === "string" && step.function_header.includes("def ");
      const returnLineValid = typeof step.return_line === "string" && step.return_line.trim().startsWith("return");
      const ok = tests.length > 0 && functionHeaderValid && returnLineValid;
      return {
        step_key: step.step_key,
        ok,
        checks: {
          has_test_cases: tests.length > 0,
          function_header_like_python_def: functionHeaderValid,
          return_line_present: returnLineValid,
        },
      };
    });

    const passedSteps = stepChecks.filter((s) => s.ok).length;
    const hasGeneralTests = generalTests.length > 0;
    const status: "passed" | "failed" | "partial" =
      hasGeneralTests && stepChecks.length > 0 && passedSteps === stepChecks.length
        ? "passed"
        : hasGeneralTests || passedSteps > 0
          ? "partial"
          : "failed";

    const result = {
      mode: "static-curation-validation",
      summary: {
        problem_id: problemId,
        general_tests_count: generalTests.length,
        sub_steps_total: stepChecks.length,
        sub_steps_passed: passedSteps,
      },
      curation_signals: {
        has_general_tests: hasGeneralTests,
        all_sub_steps_have_tests_and_function_headers: stepChecks.length > 0 && passedSteps === stepChecks.length,
      },
      step_checks: stepChecks,
    };

    const insertRes = await supabase
      .from("scicode_validation_runs")
      .insert({
        problem_id: problemId,
        status,
        result,
      })
      .select("*")
      .single();
    if (insertRes.error || !insertRes.data) {
      throw new Error(insertRes.error?.message ?? "Failed to persist validation run");
    }

    return NextResponse.json({ validation: insertRes.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

