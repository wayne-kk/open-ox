/**
 * Langfuse Cloud tracing (full prompt capture when enabled via env keys).
 *
 * Env: LANGFUSE_SECRET_KEY, LANGFUSE_PUBLIC_KEY
 * Host (optional): LANGFUSE_BASEURL (SDK default) or LANGFUSE_BASE_URL (alias).
 * Defaults to https://cloud.langfuse.com when unset — set US host for US Cloud.
 *
 * ## Session / aggregation
 * Prefer {@link resolveLangfuseSessionId}: by default **one Langfuse Session per open-ox
 * `projectId`** (intent, generate, modify all reuse the same `sessionId`), so the **Sessions**
 * tab shows **one row per site project**. Pass optional `langfuseSessionId` from the client
 * when you need a finer grouping (e.g. multiple workspaces).
 *
 * ## Pipeline continuity
 * One logical build (intent commit → async generation worker) shares a single Langfuse
 * **trace id**: pass {@link LangfuseTraceRootParams.id} into {@link runWithLangfuseTraceRoot}
 * on the worker to continue the intent-side root. Retries open a new root and may link
 * via metadata `previousTraceId`.
 *
 * Trace and span **names** are centralized in {@link ./langfuseTraceCatalog} (`ox.trace.*`,
 * `ox.span.*`) so the Langfuse tree stays sorted and filterable.
 *
 * ## Tree under a trace
 * LLM generations attach to the **current observation parent** (deepest open span, else
 * trace). Sequential {@link withLangfuseSpan} maintains a stack; for **parallel** work
 * (e.g. multiple page agents) wrap each branch with {@link runWithLangfuseSpanBranch}
 * so AsyncLocalStorage stays isolated per branch.
 *
 * ## Flush behaviour (server)
 * The singleton client uses {@link Langfuse} with **no periodic flush timer** (`flushInterval: 0`)
 * and a larger `flushAt` so long flows enqueue fewer partial batches; HTTP handlers and the
 * generation worker call {@link flushLangfuse} when the logical request/job finishes.
 * Intent may flush a mid-state (`generation_queued`); the worker updates final output later.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import Langfuse, { type LangfuseParent } from "langfuse";

export type LangfuseTraceRootParams = {
  name: string;
  /** When set, continues/upserts this existing Langfuse trace id (cross-process pipeline). */
  id?: string;
  userId?: string;
  sessionId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  input?: unknown;
};

export type LangfuseTraceUpdatePatch = {
  name?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  input?: unknown;
  output?: unknown;
};

export type LangfuseSpanAttrs<T = unknown> = {
  metadata?: Record<string, unknown>;
  input?: unknown;
  /** Structured summary for AI debugging (prefer short JSON, not full prompts). */
  getOutput?: (result: T) => unknown;
};

type LangfuseTraceHandle = ReturnType<Langfuse["trace"]>;
type LangfuseSpanHandle = ReturnType<LangfuseTraceHandle["span"]>;

export type LangfuseRunContext = {
  trace: LangfuseTraceHandle;
  /** LIFO stack of open spans; LLM parent = top or trace */
  spanStack: LangfuseSpanHandle[];
};

const langfuseRunContext = new AsyncLocalStorage<LangfuseRunContext>();

/** Memoize only a real client. Do not cache "disabled" — env may load after first call. */
let cachedLangfuseInstance: Langfuse | undefined;

function resolveLangfuseBaseUrl(): string | undefined {
  const raw =
    process.env.LANGFUSE_BASEURL?.trim() || process.env.LANGFUSE_BASE_URL?.trim();
  return raw || undefined;
}

/** Server-side singleton; omitted when secrets are unset (silent no-op). */
export function getLangfuse(): Langfuse | null {
  if (cachedLangfuseInstance !== undefined) {
    return cachedLangfuseInstance;
  }
  if (typeof process === "undefined") {
    return null;
  }
  const secret = process.env.LANGFUSE_SECRET_KEY?.trim();
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY?.trim();
  if (!secret || !publicKey) {
    return null;
  }
  const baseUrl = resolveLangfuseBaseUrl();
  /** Avoid timer-driven mid-run flushes; routes/workers call {@link flushLangfuse} at the boundary. */
  const flushInterval = 0;
  const flushAt = 512;
  cachedLangfuseInstance = new Langfuse(
    baseUrl !== undefined ? { baseUrl, flushInterval, flushAt } : { flushInterval, flushAt }
  );
  if (process.env.LANGFUSE_DEBUG === "1") {
    console.info(
      `[langfuse] client initialized baseUrl=${baseUrl ?? "default https://cloud.langfuse.com"}`
    );
  }
  return cachedLangfuseInstance;
}

function getCurrentObservationParent(ctx: LangfuseRunContext): LangfuseParent {
  return ctx.spanStack.length > 0
    ? ctx.spanStack[ctx.spanStack.length - 1]!
    : ctx.trace;
}

/** Active trace for the current async context. */
export function getLangfuseRunContext(): LangfuseRunContext | undefined {
  return langfuseRunContext.getStore();
}

/** Active Langfuse trace id, or null when tracing is inactive. */
export function getLangfuseTraceId(): string | null {
  const ctx = langfuseRunContext.getStore();
  return ctx?.trace.id ?? null;
}

/**
 * Patch the active root trace (rename, mid-state metadata, final output).
 * No-op when Langfuse is disabled or no ALS context.
 */
export function updateLangfuseActiveTrace(patch: LangfuseTraceUpdatePatch): void {
  const ctx = langfuseRunContext.getStore();
  if (!ctx) return;
  ctx.trace.update({
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
    ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
    ...(patch.input !== undefined ? { input: patch.input } : {}),
    ...(patch.output !== undefined ? { output: patch.output } : {}),
  });
}

/**
 * Stable Langfuse `sessionId` for **one Session row per open-ox project** in the Langfuse UI.
 *
 * - If the client sends `langfuseSessionId`, that wins (allows custom grouping).
 * - Otherwise uses **`projectId` only** — all traces for that site (intent / generate / modify)
 *   share one Session.
 */
export function resolveLangfuseSessionId(params: {
  projectId: string;
  clientSessionId?: string | null;
}): string {
  const client = params.clientSessionId?.trim();
  if (client) return client;
  return params.projectId;
}

/** Parent for `trace.generation()` / nested observations — span when inside withLangfuseSpan. */
export function getLangfuseGenerationParent(): LangfuseParent | null {
  const ctx = langfuseRunContext.getStore();
  return ctx ? getCurrentObservationParent(ctx) : null;
}

/**
 * Create or continue a trace root unless one already exists in ALS
 * (e.g. nested generate inside an outer worker wrapper).
 * Pass {@link LangfuseTraceRootParams.id} to continue a cross-process pipeline.
 * Does not flush — call {@link flushLangfuse} at the HTTP/job boundary.
 */
export async function runWithLangfuseTraceRoot<T>(
  params: LangfuseTraceRootParams,
  fn: () => Promise<T>
): Promise<T> {
  const lf = getLangfuse();
  if (!lf || langfuseRunContext.getStore()) {
    return fn();
  }

  const trace = lf.trace({
    ...(params.id ? { id: params.id } : {}),
    name: params.name,
    userId: params.userId,
    sessionId: params.sessionId,
    tags: params.tags,
    metadata: params.metadata,
    ...(params.input !== undefined ? { input: params.input } : {}),
  });

  const ctx: LangfuseRunContext = { trace, spanStack: [] };
  try {
    return await langfuseRunContext.run(ctx, fn);
  } catch (err) {
    trace.update({
      metadata: {
        ...(params.metadata ?? {}),
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}

/**
 * Phase span on the current trace. While the callback runs, LLM generations nest here
 * (unless a nested span or {@link runWithLangfuseSpanBranch} applies).
 */
export async function withLangfuseSpan<T>(
  name: string,
  fn: () => Promise<T>,
  attrs?: LangfuseSpanAttrs<T>
): Promise<T> {
  const lf = getLangfuse();
  const ctx = langfuseRunContext.getStore();
  if (!lf || !ctx) {
    return fn();
  }

  const parent = getCurrentObservationParent(ctx);
  const span = parent.span({
    name,
    metadata: attrs?.metadata,
    ...(attrs?.input !== undefined ? { input: attrs.input } : {}),
  });
  ctx.spanStack.push(span);
  try {
    const result = await fn();
    let output: unknown;
    let hasOutput = false;
    if (attrs?.getOutput) {
      try {
        output = attrs.getOutput(result);
        hasOutput = true;
      } catch {
        /* ignore summary failures — still end the span */
      }
    }
    span.end(hasOutput ? { output } : undefined);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    span.end({
      level: "ERROR",
      statusMessage: message,
      metadata: {
        ...(attrs?.metadata ?? {}),
        error: message,
      },
    });
    throw err;
  } finally {
    const popped = ctx.spanStack.pop();
    if (popped !== span) {
      console.warn("[langfuse] span stack desync — forcing end on", name);
    }
  }
}

/**
 * Isolated span + ALS fork for one concurrent branch (e.g. a single page in `Promise.all`).
 * Prevents span-stack corruption when multiple agents run in parallel.
 */
export async function runWithLangfuseSpanBranch<T>(
  name: string,
  fn: () => Promise<T>,
  attrs?: LangfuseSpanAttrs<T>
): Promise<T> {
  const lf = getLangfuse();
  const ctx = langfuseRunContext.getStore();
  if (!lf || !ctx) {
    return fn();
  }

  const parent = getCurrentObservationParent(ctx);
  const span = parent.span({
    name,
    metadata: attrs?.metadata,
    ...(attrs?.input !== undefined ? { input: attrs.input } : {}),
  });
  const forked: LangfuseRunContext = {
    trace: ctx.trace,
    spanStack: [...ctx.spanStack, span],
  };
  try {
    const result = await langfuseRunContext.run(forked, fn);
    let output: unknown;
    let hasOutput = false;
    if (attrs?.getOutput) {
      try {
        output = attrs.getOutput(result);
        hasOutput = true;
      } catch {
        /* ignore summary failures */
      }
    }
    span.end(hasOutput ? { output } : undefined);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    span.end({
      level: "ERROR",
      statusMessage: message,
      metadata: {
        ...(attrs?.metadata ?? {}),
        error: message,
      },
    });
    throw err;
  }
}

export async function flushLangfuse(): Promise<void> {
  const lf = getLangfuse();
  if (!lf) return;
  await lf.flushAsync().catch((e) => {
    console.warn("[langfuse] flushAsync failed:", e instanceof Error ? e.message : String(e));
  });
}
