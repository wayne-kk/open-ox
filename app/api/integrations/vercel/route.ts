import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { isVercelDeployConfigured } from "@/lib/vercel/env";
import {
  disconnectVercel,
  getVercelAccessToken,
  getVercelConnectionPublic,
  updateVercelDefaultTeam,
} from "@/lib/vercel/connections";
import { fetchVercelTeam } from "@/lib/vercel/oauth";

/** GET — connection status (no tokens). */
export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!isVercelDeployConfigured()) {
    return NextResponse.json({
      configured: false,
      connected: false,
    });
  }

  try {
    const conn = await getVercelConnectionPublic(session.user.id);
    if (!conn.connected) {
      return NextResponse.json({ configured: true, connected: false });
    }
    return NextResponse.json({
      configured: true,
      ...conn,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, code: "VERCEL_STATUS_FAILED" }, { status: 500 });
  }
}

/** PATCH — set default team `{ teamId }`. */
export async function PATCH(request: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isVercelDeployConfigured()) {
    return NextResponse.json({ error: "Not configured", code: "VERCEL_NOT_CONFIGURED" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { teamId?: string | null };
  const teamId = body.teamId === undefined ? undefined : body.teamId;

  if (teamId === undefined) {
    return NextResponse.json({ error: "teamId required", code: "BAD_REQUEST" }, { status: 400 });
  }

  const creds = await getVercelAccessToken(session.user.id);
  if (!creds) {
    return NextResponse.json({ error: "Not connected", code: "VERCEL_NOT_CONNECTED" }, { status: 400 });
  }

  let teamName: string | null = null;
  if (teamId) {
    try {
      teamName = (await fetchVercelTeam(creds.accessToken, teamId)).name;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg, code: "TEAM_LOOKUP_FAILED" }, { status: 502 });
    }
  }

  await updateVercelDefaultTeam({
    userId: session.user.id,
    teamId,
    teamName,
  });

  return NextResponse.json({
    ok: true,
    defaultTeamId: teamId,
    defaultTeamName: teamName,
  });
}

/** DELETE — disconnect (local only). */
export async function DELETE() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    await disconnectVercel(session.user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, code: "DISCONNECT_FAILED" }, { status: 500 });
  }
}
