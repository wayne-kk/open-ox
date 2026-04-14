import type { AiResponse, BuildStep } from "../types/build-studio";

interface BuildSiteCallbacks {
  onStep: (step: BuildStep) => void;
  onDone: (result: AiResponse) => void;
  onError: (msg: string) => void;
}

function processSSEChunk(
  chunk: string,
  callbacks: BuildSiteCallbacks
): void {
  const line = chunk.replace(/^data:\s*/, "").trim();
  if (!line) return;

  try {
    const event = JSON.parse(line) as {
      type: "step" | "done" | "error";
      [key: string]: unknown;
    };

    if (event.type === "step") {
      callbacks.onStep(event as unknown as BuildStep);
    } else if (event.type === "done") {
      callbacks.onDone(event.result as AiResponse);
    } else if (event.type === "error") {
      callbacks.onError(String(event.message));
    }
  } catch {
    // ignore malformed SSE chunks
  }
}

export async function runBuildSite(
  input: string,
  callbacks: BuildSiteCallbacks,
  signal?: AbortSignal,
  options?: {
    model?: string;
    retryProjectId?: string;
    projectId?: string;
    styleGuide?: string;
    enableSkills?: boolean;
    /** When false, core step prompts use repo defaults only (skip DB overrides). Default on server is true. */
    useDatabasePrompts?: boolean;
  }
): Promise<void> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userPrompt: input,
      ...(options?.model ? { model: options.model } : {}),
      ...(options?.retryProjectId ? { retryProjectId: options.retryProjectId } : {}),
      ...(options?.projectId ? { projectId: options.projectId } : {}),
      ...(options?.styleGuide ? { styleGuide: options.styleGuide } : {}),
      ...(options?.enableSkills ? { enableSkills: true } : {}),
      ...(options?.useDatabasePrompts === false ? { useDatabasePrompts: false } : {}),
    }),
    signal,
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = `/auth?redirect=${encodeURIComponent(window.location.pathname)}`;
    }
    callbacks.onError("请先登录");
    return;
  }

  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("text/event-stream")) {
    const reader = res.body?.getReader();
    if (!reader) throw new Error("SSE stream unavailable");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() ?? "";

      for (const chunk of lines) {
        processSSEChunk(chunk, callbacks);
      }
    }

    // Flush any remaining data left in the buffer after the stream closes.
    // This handles the edge case where the server closes the connection
    // without a trailing \n\n, leaving the last event stranded in buffer.
    if (buffer.trim()) {
      processSSEChunk(buffer, callbacks);
    }
  } else {
    const data = (await res.json()) as AiResponse;
    if (data.error) {
      callbacks.onError(data.error);
    } else {
      callbacks.onDone(data);
    }
  }
}

export async function clearTemplate(): Promise<void> {
  const res = await fetch("/api/clear-template", { method: "POST" });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
}
