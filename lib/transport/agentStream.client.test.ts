import { describe, expect, it } from "vitest";

import { createAgentStreamClientSession } from "./agentStream.client";
import { createAgentStreamServerSession } from "./agentStream.server";

describe("agentStream browser client codec", () => {
  it("round-trips through Web Crypto HKDF + AES-GCM (matches Node server)", async () => {
    const clientSession = await createAgentStreamClientSession();
    const server = createAgentStreamServerSession(clientSession.clientPublicKeySpki);
    const init = server.cryptoInitEvent();

    expect(await clientSession.handleWireEvent(init)).toBeNull();

    const payload = {
      type: "intent_agent_turn",
      turn: {
        assistantMessage: "hello".repeat(500),
        briefDraftMarkdown: "# Brief\n".repeat(200),
      },
    };

    const enc = server.encode(payload);
    const decoded = await clientSession.handleWireEvent(enc);
    expect(decoded).toEqual(payload);
  });

  it("rejects enc events before crypto_init", async () => {
    const clientSession = await createAgentStreamClientSession();
    const server = createAgentStreamServerSession(clientSession.clientPublicKeySpki);
    const enc = server.encode({ type: "step", name: "x", status: "running" });

    await expect(clientSession.handleWireEvent(enc)).rejects.toThrow(
      /before crypto_init/
    );
  });
});
