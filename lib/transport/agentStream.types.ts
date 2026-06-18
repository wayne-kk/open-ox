/** Wire format version for secure agent SSE payloads. */
export const AGENT_STREAM_CODEC_VERSION = 1;

export const AGENT_STREAM_HKDF_INFO = "open-ox-agent-stream-v1";

export type AgentStreamCryptoInitEvent = {
  type: "crypto_init";
  v: typeof AGENT_STREAM_CODEC_VERSION;
  serverPublicKey: string;
};

export type AgentStreamEncEvent = {
  type: "enc";
  v: typeof AGENT_STREAM_CODEC_VERSION;
  iv: string;
  data: string;
};

export function isAgentStreamCryptoInitEvent(
  value: unknown
): value is AgentStreamCryptoInitEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as AgentStreamCryptoInitEvent).type === "crypto_init" &&
    (value as AgentStreamCryptoInitEvent).v === AGENT_STREAM_CODEC_VERSION &&
    typeof (value as AgentStreamCryptoInitEvent).serverPublicKey === "string"
  );
}

export function isAgentStreamEncEvent(value: unknown): value is AgentStreamEncEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as AgentStreamEncEvent).type === "enc" &&
    (value as AgentStreamEncEvent).v === AGENT_STREAM_CODEC_VERSION &&
    typeof (value as AgentStreamEncEvent).iv === "string" &&
    typeof (value as AgentStreamEncEvent).data === "string"
  );
}
