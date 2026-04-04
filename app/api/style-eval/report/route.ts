/**
 * POST /api/style-eval/report
 * 保存评测报告为 md 文件，返回文件路径
 * body: { content: string, filename?: string }
 */

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const REPORT_DIR = path.join(process.cwd(), "style-eval-reports");

export async function POST(req: Request) {
    try {
        const { content, filename } = await req.json();
        if (!content || typeof content !== "string") {
            return NextResponse.json({ error: "Missing content" }, { status: 400 });
        }

        await fs.mkdir(REPORT_DIR, { recursive: true });

        const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const name = filename ? `${filename}.md` : `style-eval-${ts}.md`;
        const filePath = path.join(REPORT_DIR, name);

        await fs.writeFile(filePath, content, "utf-8");

        return NextResponse.json({ path: `style-eval-reports/${name}` });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
