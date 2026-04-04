/**
 * Style Evaluation API - POST /api/style-eval
 *
 * 调用 Dify workflow API，输入 query，流式返回结果
 * body: { query: string }
 *
 * Dify workflow 输出变量：style1, style2, problem1, problem2, Comparison
 */

import { NextResponse } from "next/server";

export async function POST(req: Request) {
    // 运行时读取，避免模块级缓存导致 env 为空
    const DIFY_API_URL = process.env.DIFY_API_URL ?? "http://47.94.241.58:9000/v1";
    const DIFY_API_KEY = process.env.DIFY_API_KEY ?? "";

    try {
        const { query } = await req.json();

        if (!query || typeof query !== "string") {
            return NextResponse.json({ error: "Missing or invalid 'query'" }, { status: 400 });
        }
        if (!DIFY_API_KEY) {
            return NextResponse.json({ error: "DIFY_API_KEY is not configured" }, { status: 500 });
        }

        const url = `${DIFY_API_URL}/workflows/run`;
        console.log("[style-eval] calling Dify:", url);

        const difyRes = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${DIFY_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                inputs: { query },
                response_mode: "streaming",
                user: "style-eval-user",
            }),
        });

        if (!difyRes.ok) {
            const errText = await difyRes.text();
            console.error("[style-eval] Dify error:", difyRes.status, errText);
            return NextResponse.json(
                { error: `Dify API error: ${difyRes.status} - ${errText}` },
                { status: 502 },
            );
        }

        // 透传 SSE 流
        return new Response(difyRes.body, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
            },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[style-eval] catch error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
