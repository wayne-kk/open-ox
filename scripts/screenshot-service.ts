/**
 * Screenshot Service — localhost HTTP for Playwright cover + reference captures.
 *
 *   pnpm screenshot:dev
 *   # or PM2 app open-ox-screenshot
 *
 * Listens on 127.0.0.1 only. Auth: Authorization Bearer
 * OPEN_OX_SCREENSHOT_SECRET (fallback OPEN_OX_PREVIEW_CAPTURE_SECRET).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { captureCoverViewportJpeg } from "@/lib/screenshot/coverViewportCapture";
import { captureExternalReferencePageImpl } from "@/lib/screenshot/referencePageCapture";

/** Load `.env*` without overriding existing keys (same pattern as generation-worker). */
function loadEnvFiles(dir: string): void {
  const files =
    process.env.NODE_ENV === "production"
      ? [".env.production.local", ".env.local", ".env.production", ".env"]
      : [".env.development.local", ".env.local", ".env.development", ".env"];
  for (const name of files) {
    const path = join(dir, name);
    if (!existsSync(path)) continue;
    for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      if (!key || process.env[key] !== undefined) continue;
      let val = line.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

loadEnvFiles(process.cwd());

const HOST = "127.0.0.1";
const PORT = Number(process.env.OPEN_OX_SCREENSHOT_PORT || process.env.PORT || 3921);
const COVER_REQUEST_TIMEOUT_MS = 180_000;
const REFERENCE_REQUEST_TIMEOUT_MS = 60_000;

function getScreenshotSecret(): string | null {
  const a = process.env.OPEN_OX_SCREENSHOT_SECRET?.trim();
  if (a) return a;
  const b = process.env.OPEN_OX_PREVIEW_CAPTURE_SECRET?.trim();
  return b || null;
}

function secretMatches(provided: string | null | undefined): boolean {
  const expected = getScreenshotSecret();
  if (!expected || provided == null) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function bearerToken(req: IncomingMessage): string | null {
  const h = req.headers.authorization;
  if (!h || typeof h !== "string") return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m?.[1]?.trim() || null;
}

function readJsonBody(req: IncomingMessage, maxBytes = 256_000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (c: Buffer) => {
      total += c.length;
      if (total > maxBytes) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        if (!raw.trim()) {
          resolve({});
          return;
        }
        resolve(JSON.parse(raw) as unknown);
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function requireAuth(req: IncomingMessage, res: ServerResponse): boolean {
  if (!getScreenshotSecret()) {
    sendJson(res, 503, {
      ok: false,
      error:
        "Screenshot service misconfigured: set OPEN_OX_SCREENSHOT_SECRET or OPEN_OX_PREVIEW_CAPTURE_SECRET",
    });
    return false;
  }
  if (!secretMatches(bearerToken(req))) {
    sendJson(res, 401, { ok: false, error: "Unauthorized" });
    return false;
  }
  return true;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  const method = (req.method || "GET").toUpperCase();

  try {
    if (method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === "POST" && url.pathname === "/v1/cover-viewport") {
      if (!requireAuth(req, res)) return;
      const body = (await readJsonBody(req)) as {
        url?: string;
        extraHeaders?: Record<string, string> | null;
        polish?: boolean;
      };
      if (!body.url || typeof body.url !== "string") {
        sendJson(res, 400, { ok: false, error: "Missing url" });
        return;
      }
      const jpeg = await withTimeout(
        captureCoverViewportJpeg({
          url: body.url,
          extraHeaders: body.extraHeaders ?? null,
          polish: body.polish !== false,
        }),
        COVER_REQUEST_TIMEOUT_MS,
        "cover-viewport"
      );
      res.writeHead(200, {
        "Content-Type": "image/jpeg",
        "Content-Length": jpeg.length,
      });
      res.end(jpeg);
      return;
    }

    if (method === "POST" && url.pathname === "/v1/reference-page") {
      if (!requireAuth(req, res)) return;
      const body = (await readJsonBody(req)) as { url?: string };
      if (!body.url || typeof body.url !== "string") {
        sendJson(res, 400, { ok: false, error: "Missing url" });
        return;
      }
      const result = await withTimeout(
        captureExternalReferencePageImpl(body.url),
        REFERENCE_REQUEST_TIMEOUT_MS,
        "reference-page"
      );
      sendJson(res, 200, result);
      return;
    }

    sendJson(res, 404, { ok: false, error: "Not found" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[screenshot-service]", msg);
    if (!res.headersSent) {
      sendJson(res, 500, { ok: false, error: msg });
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[screenshot-service] listening on http://${HOST}:${PORT}`);
  if (!getScreenshotSecret()) {
    console.warn(
      "[screenshot-service] WARN: no OPEN_OX_SCREENSHOT_SECRET / OPEN_OX_PREVIEW_CAPTURE_SECRET — requests will 503"
    );
  } else {
    console.log("[screenshot-service] auth secret loaded");
  }
});
