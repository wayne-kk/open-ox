import type { AiResponse, BuildStep } from "../types/build-studio";

interface BuildSiteCallbacks {
  onStep: (step: BuildStep) => void;
  onDone: (result: AiResponse) => void;
  onError: (msg: string) => void;
}

export async function runBuildSite(
  input: string,
  callbacks: BuildSiteCallbacks,
  signal?: AbortSignal,
  options?: { model?: string; retryProjectId?: string }
): Promise<void> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userPrompt: input,
      ...(options?.model ? { model: options.model } : {}),
      ...(options?.retryProjectId ? { retryProjectId: options.retryProjectId } : {}),
    }),
    signal,
  });

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
        const line = chunk.replace(/^data:\s*/, "").trim();
        if (!line) continue;

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
