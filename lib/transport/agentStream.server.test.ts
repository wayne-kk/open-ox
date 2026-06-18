import { describe, expect, it } from "vitest";
import {
  createAgentStreamClientSessionForTest,
  createAgentStreamServerSession,
  exportSpkiFromGeneratedKeyPair,
} from "./agentStream.server";

describe("agentStream secure codec", () => {
  it("round-trips large agent payloads through compress+encrypt", () => {
    const clientKeys = exportSpkiFromGeneratedKeyPair();
    const server = createAgentStreamServerSession(clientKeys.publicKeySpkiBase64Url);
    const init = server.cryptoInitEvent();
    const client = createAgentStreamClientSessionForTest(
      clientKeys.privateKeyPkcs8,
      init.serverPublicKey
    );

    const payload = {
      type: "diff",
      file: "app/page.tsx",
      patch: "a".repeat(4000),
      reasoning: "test",
    };
    const enc = server.encode(payload);
    const decoded = client.decode(enc);
    expect(decoded).toEqual(payload);
  });

  it("handles nested SSE event shapes", () => {
    const clientKeys = exportSpkiFromGeneratedKeyPair();
    const server = createAgentStreamServerSession(clientKeys.publicKeySpkiBase64Url);
    const init = server.cryptoInitEvent();
    const client = createAgentStreamClientSessionForTest(
      clientKeys.privateKeyPkcs8,
      init.serverPublicKey
    );

    const payload = {
      type: "step",
      name: "agent_loop",
      status: "running",
      message: "iter=2 tools=read_file,edit_file",
    };
    expect(client.decode(server.encode(payload))).toEqual(payload);
  });
});
