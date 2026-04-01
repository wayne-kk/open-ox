import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
    const { prompt, model, maxTokens, useSDK } = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_API_URL;
    const resolvedModel = model || process.env.OPENAI_MODEL || "gpt-5.2";

    if (!apiKey) {
        return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });
    }

    const start = Date.now();

    // ── SDK path ───────────────────────────────────────────────────────────────
    if (useSDK) {
        try {
            const client = new OpenAI({
                apiKey,
                baseURL,
                timeout: 180_000,
                maxRetries: 0,
            });

            const res = await client.chat.completions.create({
                model: resolvedModel,
                messages: [{ role: "user", content: prompt || "Say hello" }],
                ...(maxTokens ? { max_tokens: maxTokens } : {}),
            });

            const elapsed = Date.now() - start;
            return NextResponse.json({
                success: true,
                method: "OpenAI SDK",
                elapsed,
                content: res.choices[0]?.message?.content ?? "",
                usage: res.usage,
                model: res.model,
                finishReason: res.choices[0]?.finish_reason,
                config: { baseURL, model: resolvedModel },
            });
        } catch (err: unknown) {
            const elapsed = Date.now() - start;
            const e = err as { status?: number; code?: string; message?: string; cause?: { code?: string; message?: string; cause?: { code?: string; message?: string } } };
            const causes: string[] = [];
            let cursor = e.cause;
            for (let d = 0; cursor && d < 5; d++) {
                causes.push(`${cursor.code ?? ""} ${cursor.message ?? ""}`);
                cursor = (cursor as { cause?: typeof cursor }).cause;
            }
            return NextResponse.json({
                success: false,
                method: "OpenAI SDK",
                elapsed,
                error: e.message,
                code: e.code ?? e.cause?.code,
                status: e.status,
                causeChain: causes,
                config: { baseURL, model: resolvedModel },
            });
        }
    }

    // ── Native fetch path ──────────────────────────────────────────────────────
    try {
        const res = await fetch(`${baseURL || "https://api.openai.com/v1"}/chat/completions`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: resolvedModel,
                messages: [{ role: "user", content: prompt || "Say hello" }],
                ...(maxTokens ? { max_tokens: maxTokens } : {}),
            }),
            signal: AbortSignal.timeout(180_000),
        });

        const elapsed = Date.now() - start;
        const data = await res.json();

        if (!res.ok) {
            return NextResponse.json({
                success: false, method: "native fetch", elapsed,
                httpStatus: res.status, error: data,
                config: { baseURL, model: resolvedModel },
            });
        }

        return NextResponse.json({
            success: true, method: "native fetch", elapsed,
            httpStatus: res.status,
            content: data.choices?.[0]?.message?.content ?? "",
            usage: data.usage, model: data.model,
            finishReason: data.choices?.[0]?.finish_reason,
            config: { baseURL, model: resolvedModel },
        });
    } catch (err: unknown) {
        const elapsed = Date.now() - start;
        const e = err as { code?: string; cause?: { code?: string; message?: string }; message?: string };
        return NextResponse.json({
            success: false, method: "native fetch", elapsed,
            error: e.message, code: e.code ?? e.cause?.code, cause: e.cause?.message,
            config: { baseURL, model: resolvedModel },
        });
    }
}
