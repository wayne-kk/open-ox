import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type SciSubStepInput = {
  step_number: number | string;
  step_description_prompt: string;
  function_header: string;
  test_cases: unknown[];
  return_line: string;
};

type SciProblemInput = {
  problem_id: string;
  problem_name: string;
  problem_description_main: string;
  problem_io: string;
  required_dependencies: unknown[];
  general_tests: unknown[];
  domain?: string;
  difficulty?: string;
  tags?: unknown[];
  sub_steps: SciSubStepInput[];
};

function validateProblem(body: unknown): { ok: true; value: SciProblemInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, error: "Body must be object" };
  const b = body as Record<string, unknown>;
  const requiredText = [
    "problem_id",
    "problem_name",
    "problem_description_main",
    "problem_io",
  ] as const;
  for (const k of requiredText) {
    if (typeof b[k] !== "string" || !(b[k] as string).trim()) return { ok: false, error: `Missing or invalid '${k}'` };
  }
  if (!Array.isArray(b.required_dependencies)) return { ok: false, error: "required_dependencies must be array" };
  if (!Array.isArray(b.general_tests) || b.general_tests.length === 0) return { ok: false, error: "general_tests must be non-empty array" };
  if (!Array.isArray(b.sub_steps) || b.sub_steps.length === 0) return { ok: false, error: "sub_steps must be non-empty array" };

  for (let i = 0; i < b.sub_steps.length; i += 1) {
    const step = b.sub_steps[i] as Record<string, unknown>;
    if (typeof step !== "object" || step === null || Array.isArray(step)) return { ok: false, error: `sub_steps[${i}] must be object` };
    const checks: Array<[Exclude<keyof SciSubStepInput, "step_number">, string]> = [
      ["step_description_prompt", "string"],
      ["function_header", "string"],
      ["return_line", "string"],
    ];
    for (const [key, type] of checks) {
      if (typeof step[key] !== type || (type === "string" && !(step[key] as string).trim())) {
        return { ok: false, error: `sub_steps[${i}].${key} is invalid` };
      }
    }
    const rawStepNumber = step.step_number;
    const stepNumberValid =
      typeof rawStepNumber === "number"
        ? Number.isFinite(rawStepNumber)
        : typeof rawStepNumber === "string" && rawStepNumber.trim().length > 0;
    if (!stepNumberValid) {
      return { ok: false, error: `sub_steps[${i}].step_number is invalid` };
    }
    if (!Array.isArray(step.test_cases) || step.test_cases.length === 0) {
      return { ok: false, error: `sub_steps[${i}].test_cases must be non-empty array` };
    }
  }
  return { ok: true, value: b as unknown as SciProblemInput };
}

function parseStepOrder(stepNumber: number | string): number {
  if (typeof stepNumber === "number") return stepNumber;
  const asNumber = Number(stepNumber);
  if (Number.isFinite(asNumber)) return asNumber;
  const normalized = stepNumber.trim().replace(/[^\d.]+/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 9_999_999;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit")) || 20));
    const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
    const domain = searchParams.get("domain");
    const difficulty = searchParams.get("difficulty");
    const tag = searchParams.get("tag");

    let query = supabase
      .from("scicode_problems")
      .select("problem_id,problem_name,domain,difficulty,tags,created_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (domain) query = query.eq("domain", domain);
    if (difficulty) query = query.eq("difficulty", difficulty);
    if (tag) query = query.contains("tags", [tag]);

    const result = await query;
    if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ problems: result.data ?? [], count: (result.data ?? []).length, limit, offset });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = validateProblem(body);
    if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
    const input = validated.value;

    const problemUpsert = await supabase
      .from("scicode_problems")
      .upsert(
        {
          problem_id: input.problem_id,
          problem_name: input.problem_name,
          problem_description_main: input.problem_description_main,
          problem_io: input.problem_io,
          required_dependencies: input.required_dependencies,
          general_tests: input.general_tests,
          domain: input.domain ?? null,
          difficulty: input.difficulty ?? null,
          tags: input.tags ?? [],
          updated_at: new Date().toISOString(),
        },
        { onConflict: "problem_id" }
      )
      .select("*")
      .single();
    if (problemUpsert.error || !problemUpsert.data) {
      throw new Error(problemUpsert.error?.message ?? "Failed to upsert problem");
    }

    await supabase.from("scicode_sub_steps").delete().eq("problem_id", input.problem_id);
    const stepRows = input.sub_steps.map((s) => ({
      problem_id: input.problem_id,
      step_number: Math.max(1, Math.floor(parseStepOrder(s.step_number))),
      step_key: String(s.step_number).trim(),
      step_order: parseStepOrder(s.step_number),
      step_description_prompt: s.step_description_prompt,
      function_header: s.function_header,
      test_cases: s.test_cases,
      return_line: s.return_line,
      updated_at: new Date().toISOString(),
    }));
    const stepInsert = await supabase.from("scicode_sub_steps").insert(stepRows);
    if (stepInsert.error) throw new Error(stepInsert.error.message);

    return NextResponse.json({ problem: problemUpsert.data, sub_steps_count: stepRows.length }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

