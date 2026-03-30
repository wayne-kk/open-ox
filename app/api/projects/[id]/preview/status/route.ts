import { NextRequest, NextResponse } from "next/server";
import { getDevServerStatus } from "@/lib/devServerManager";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const status = await getDevServerStatus(id);
  return NextResponse.json(status);
}
