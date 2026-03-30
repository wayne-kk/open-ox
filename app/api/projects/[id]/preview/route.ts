import { NextRequest, NextResponse } from "next/server";
import { startDevServer, stopDevServer } from "@/lib/devServerManager";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const result = await startDevServer(id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Project directory not found")) {
      return NextResponse.json(
        { error: "Project directory not found", code: "PROJECT_DIR_NOT_FOUND" },
        { status: 404 }
      );
    }
    console.error("[POST /api/projects/[id]/preview]", err);
    return NextResponse.json(
      { error: "Failed to start dev server", code: "DEV_SERVER_ERROR" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await stopDevServer(id);
  return new NextResponse(null, { status: 204 });
}
