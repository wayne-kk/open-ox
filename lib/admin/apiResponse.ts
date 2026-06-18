import { NextResponse } from "next/server";

export type ApiMeta = Record<string, unknown>;

export function apiSuccess<T>(data: T, meta?: ApiMeta, status = 200) {
  return NextResponse.json({ success: true, data, error: null, meta: meta ?? null }, { status });
}

export function apiError(message: string, status = 500, code?: string) {
  return NextResponse.json(
    { success: false, data: null, error: message, meta: code ? { code } : null },
    { status }
  );
}
