import {
  AGENT_STREAM_HKDF_INFO,
  isAgentStreamCryptoInitEvent,
  isAgentStreamEncEvent,
  type AgentStreamEncEvent,
} from "./agentStream.types";

const GCM_TAG_BYTES = 16;

function decodeBase64Url(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function exportSpki(publicKey: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey("spki", publicKey);
  return encodeBase64Url(new Uint8Array(spki));
}

async function deriveAesKey(
  privateKey: CryptoKey,
  serverPublicKeySpkiBase64Url: string
): Promise<CryptoKey> {
  const spkiBytes = new Uint8Array(decodeBase64Url(serverPublicKeySpkiBase64Url));
  const serverPublicKey = await crypto.subtle.importKey(
    "spki",
    spkiBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: serverPublicKey },
    privateKey,
    256
  );
  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    sharedSecret,
    "HKDF",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(AGENT_STREAM_HKDF_INFO),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

async function gunzipBytes(compressed: Uint8Array): Promise<Uint8Array> {
  const copy = new Uint8Array(compressed);
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream("gzip"));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

async function decryptEncEvent(event: AgentStreamEncEvent, aesKey: CryptoKey): Promise<string> {
  const iv = new Uint8Array(decodeBase64Url(event.iv));
  const packed = decodeBase64Url(event.data);
  if (packed.length < GCM_TAG_BYTES) {
    throw new Error("Invalid encrypted payload");
  }
  // Web Crypto AES-GCM expects ciphertext || authTag in one buffer (Node splits tag separately).
  const ciphertextWithTag = new Uint8Array(packed);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    ciphertextWithTag
  );
  const decompressed = await gunzipBytes(new Uint8Array(decrypted));
  return new TextDecoder().decode(decompressed);
}

export type AgentStreamClientSession = {
  clientPublicKeySpki: string;
  handleWireEvent: (event: unknown) => Promise<Record<string, unknown> | null>;
};

export async function createAgentStreamClientSession(): Promise<AgentStreamClientSession> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
  const clientPublicKeySpki = await exportSpki(keyPair.publicKey);
  let aesKey: CryptoKey | null = null;
  // Serialize wire handling so enc from the same SSE chunk cannot race ahead of
  // async ECDH/HKDF in crypto_init (see useBuildStudio fire-and-forget decode).
  let wireQueue: Promise<unknown> = Promise.resolve();

  return {
    clientPublicKeySpki,
    handleWireEvent(event: unknown): Promise<Record<string, unknown> | null> {
      const run = async (): Promise<Record<string, unknown> | null> => {
        if (isAgentStreamCryptoInitEvent(event)) {
          aesKey = await deriveAesKey(keyPair.privateKey, event.serverPublicKey);
          return null;
        }
        if (isAgentStreamEncEvent(event)) {
          if (!aesKey) {
            throw new Error("Encrypted SSE event received before crypto_init");
          }
          const json = await decryptEncEvent(event, aesKey);
          return JSON.parse(json) as Record<string, unknown>;
        }
        if (typeof event === "object" && event !== null) {
          return event as Record<string, unknown>;
        }
        return null;
      };
      const result = wireQueue.then(run, run);
      wireQueue = result.then(
        () => undefined,
        () => undefined
      );
      return result;
    },
  };
}

export function isSecureAgentStreamSupported(): boolean {
  return (
    typeof globalThis.crypto !== "undefined" &&
    typeof crypto.subtle !== "undefined" &&
    typeof DecompressionStream !== "undefined"
  );
}

export async function decodeAgentSseJsonLine(
  session: AgentStreamClientSession | null,
  jsonLine: string
): Promise<Record<string, unknown> | null> {
  try {
    const wire = JSON.parse(jsonLine) as unknown;
    if (session) {
      return await session.handleWireEvent(wire);
    }
    if (typeof wire === "object" && wire !== null) {
      return wire as Record<string, unknown>;
    }
    return null;
  } catch (err) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[agent-stream] failed to decode SSE line:", err);
    }
    return null;
  }
}
