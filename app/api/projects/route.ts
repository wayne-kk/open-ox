import { NextResponse } from "next/server";
import { listProjects } from "@/lib/projectManager";

export async function GET() {
  try {
    const projects = await listProjects();
    const sorted = [...projects].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return NextResponse.json(sorted);
  } catch (err) {
    console.error("[GET /api/projects]", err);
    return NextResponse.json(
      { error: "Failed to list projects", code: "LIST_PROJECTS_ERROR" },
      { status: 500 }
    );
  }
}
