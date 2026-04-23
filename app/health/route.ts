import { NextResponse } from "next/server";

/** Liveness/readiness for Kubernetes (e.g. GET /health → 200). */
export async function GET() {
  return new NextResponse(null, { status: 200 });
}
