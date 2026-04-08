import { NextResponse } from "next/server";
import { listProjectsSummary, createProject } from "@/lib/projectManager";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = Number(searchParams.get("limit"));
    const offsetParam = Number(searchParams.get("offset"));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : undefined;
    const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? Math.floor(offsetParam) : 0;
    const projects = await listProjectsSummary({ limit, offset });
    return NextResponse.json(projects);
  } catch (err) {
    console.error("[GET /api/projects]", err);
    return NextResponse.json(
      { error: "Failed to list projects", code: "LIST_PROJECTS_ERROR" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userPrompt, modelId, styleGuide } = body as { userPrompt: string; modelId?: string; styleGuide?: string };
    if (!userPrompt?.trim()) {
      return NextResponse.json({ error: "userPrompt is required" }, { status: 400 });
    }
    const project = await createProject(userPrompt.trim(), modelId);
    return NextResponse.json({ projectId: project.id, styleGuide: styleGuide ?? null });
  } catch (err) {
    console.error("[POST /api/projects]", err);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
