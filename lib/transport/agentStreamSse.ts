import type { AgentStreamServerSession } from "./agentStream.server";

export function createAgentSseSender(params: {
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
  secureSession?: AgentStreamServerSession | null;
}): (event: Record<string, unknown>) => void {
  const { controller, encoder, secureSession } = params;
  let cryptoInitSent = false;

  return (event: Record<string, unknown>) => {
    if (secureSession) {
      if (!cryptoInitSent) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(secureSession.cryptoInitEvent())}\n\n`)
        );
        cryptoInitSent = true;
      }
      const enc = secureSession.encode(event);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(enc)}\n\n`));
      return;
    }
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  };
}

export function parseSseDataLine(chunk: string): string | null {
  const trimmed = chunk.trim();
  if (!trimmed) return null;
  const line = trimmed.startsWith("data:") ? trimmed.replace(/^data:\s*/, "").trim() : trimmed;
  return line || null;
}
