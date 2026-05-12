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
 * Trace and span **names** are centralized in {@link ./langfuseTraceCatalog} (`ox.trace.*`,
 * `ox.span.*`) so the Langfuse tree stays sorted and filterable.
 *
 * ## Tree under a trace
 * LLM generations attach to the **current observation parent** (deepest open span, else
 * trace). Sequential {@link withLangfuseSpan} maintains a stack; for **parallel** work
 * (e.g. multiple page agents) wrap each branch with {@link runWithLangfuseSpanBranch}
 * so AsyncLocalStorage stays isolated per branch.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import Langfuse, { type LangfuseParent } from "langfuse";

export type LangfuseTraceRootParams = {
  name: string;
  userId?: string;
  sessionId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  input?: unknown;
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
  cachedLangfuseInstance = new Langfuse(baseUrl !== undefined ? { baseUrl } : {});
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

/**
 * Stable Langfuse `sessionId` for **one Session row per open-ox project** in the Langfuse UI.
 *
 * - If the client sends `langfuseSessionId`, that wins (allows custom grouping).
 * - Otherwise uses **`projectId` only** — all traces for that site (intent / generate / modify)
 *   share one Session. (Trajectory run ids are intentionally **not** folded in, so each HTTP
 *   batch does not create a separate Session.)
 *
 * @param trajectoryRunId Unused; kept for call-site compatibility.
 */
export function resolveLangfuseSessionId(params: {
  projectId: string;
  clientSessionId?: string | null;
  /** @deprecated Ignored. Session is keyed by `projectId` unless `clientSessionId` is set. */
  trajectoryRunId?: string | null;
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
 * Create a trace root unless one already exists (e.g. nested generate inside intent-agent).
 * Does not flush — call {@link flushLangfuse} at the HTTP boundary when the logical run ends.
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
  attrs?: { metadata?: Record<string, unknown> }
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
  });
  ctx.spanStack.push(span);
  try {
    return await fn();
  } finally {
    const popped = ctx.spanStack.pop();
    if (popped !== span) {
      console.warn("[langfuse] span stack desync — forcing end on", name);
    }
    span.end();
  }
}

/**
 * Isolated span + ALS fork for one concurrent branch (e.g. a single page in `Promise.all`).
 * Prevents span-stack corruption when multiple agents run in parallel.
 */
export async function runWithLangfuseSpanBranch<T>(
  name: string,
  fn: () => Promise<T>,
  attrs?: { metadata?: Record<string, unknown> }
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
  });
  const forked: LangfuseRunContext = {
    trace: ctx.trace,
    spanStack: [...ctx.spanStack, span],
  };
  try {
    return await langfuseRunContext.run(forked, fn);
  } finally {
    span.end();
  }
}

export async function flushLangfuse(): Promise<void> {
  const lf = getLangfuse();
  if (!lf) return;
  await lf.flushAsync().catch((e) => {
    console.warn("[langfuse] flushAsync failed:", e instanceof Error ? e.message : String(e));
  });
}
