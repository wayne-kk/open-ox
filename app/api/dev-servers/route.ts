import { NextResponse } from "next/server";
import { listDevServers, stopDevServer } from "@/lib/devServerManager";

export async function GET() {
    const servers = await listDevServers();
    return NextResponse.json(servers);
}

export async function DELETE(req: Request) {
    const { projectId } = await req.json();
    if (!projectId) {
        return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }
    await stopDevServer(projectId);
    return NextResponse.json({ ok: true });
}
