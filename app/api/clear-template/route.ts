import { clearTemplate } from "@/lib/clearTemplate";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const result = clearTemplate();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[clear-template]", err);
    return NextResponse.json(
      { removed: [], error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
