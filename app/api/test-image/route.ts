import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const model =
      typeof body.model === "string" && body.model.trim()
        ? body.model.trim()
        : process.env.ARK_IMAGE_MODEL?.trim() || "doubao-seedream-4-0-250828";
    const size = typeof body.size === "string" ? body.size : "1K";
    const watermark = typeof body.watermark === "boolean" ? body.watermark : false;

    const apiKey = process.env.ARK_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: "ARK_API_KEY not configured" }, { status: 500 });
    }

    const baseUrl = (
      process.env.ARK_BASE_URL?.trim() ||
      "https://ark.cn-beijing.volces.com/api/v3"
    ).replace(/\/$/, "");

    const arkBody = {
      model,
      prompt,
      size,
      response_format: "b64_json",
      watermark,
    };

    const start = Date.now();

    const res = await fetch(`${baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(arkBody),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Ark API ${res.status}: ${text.slice(0, 500)}` },
        { status: 502 },
      );
    }

    type ArkResponse = {
      data?: Array<{ b64_json?: string; url?: string }>;
      error?: { message?: string };
    };
    const json = (await res.json()) as ArkResponse;

    if (json.error?.message) {
      return NextResponse.json({ error: json.error.message }, { status: 502 });
    }

    const duration = Date.now() - start;
    const b64 = json.data?.[0]?.b64_json;
    const remoteUrl = json.data?.[0]?.url;

    let imageUrl: string;
    if (b64) {
      imageUrl = `data:image/png;base64,${b64}`;
    } else if (remoteUrl) {
      imageUrl = remoteUrl;
    } else {
      return NextResponse.json({ error: "No image data returned" }, { status: 502 });
    }

    return NextResponse.json({
      url: imageUrl,
      duration,
      params: { model, size, watermark },
    });
  } catch (e) {
    console.error("[test-image]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to generate image" },
      { status: 500 },
    );
  }
}
