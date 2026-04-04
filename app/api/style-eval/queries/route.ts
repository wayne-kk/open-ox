/**
 * /api/style-eval/queries
 * GET  — 获取所有 queries
 * POST — 新增 query { text: string }
 */

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const TABLE = "style_eval_queries";

export async function GET() {
    const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function POST(req: Request) {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
        return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const { data, error } = await supabase
        .from(TABLE)
        .insert({ text })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}
