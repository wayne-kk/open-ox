import { NextResponse } from "next/server";
import { isProjectCreationMaintenance } from "@/lib/projectCreationMaintenance.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const maintenance = await isProjectCreationMaintenance();
  return NextResponse.json(
    { maintenance },
    { headers: { "Cache-Control": "no-store" } }
  );
}
