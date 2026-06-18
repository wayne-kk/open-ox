import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  type KeyObject,
} from "crypto";
import { gzipSync, gunzipSync } from "zlib";
import {
  AGENT_STREAM_CODEC_VERSION,
  AGENT_STREAM_HKDF_INFO,
  type AgentStreamCryptoInitEvent,
  type AgentStreamEncEvent,
} from "./agentStream.types";

const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;
const EC_CURVE = "prime256v1";

function decodeBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, "base64");
}

function encodeBase64Url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

function deriveAesKey(sharedSecret: Buffer): Buffer {
  return Buffer.from(hkdfSync("sha256", sharedSecret, "", AGENT_STREAM_HKDF_INFO, 32));
}

function importSpkiPublicKey(spkiBase64Url: string): KeyObject {
  return createPublicKey({
    key: decodeBase64Url(spkiBase64Url),
    format: "der",
    type: "spki",
  });
}

function encryptPayload(plaintext: Buffer, aesKey: Buffer): AgentStreamEncEvent {
  const iv = randomBytes(GCM_IV_BYTES);
  const compressed = gzipSync(plaintext);
  const cipher = createCipheriv("aes-256-gcm", aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const tag = cipher.getAuthTag();
  const data = Buffer.concat([encrypted, tag]);
  return {
    type: "enc",
    v: AGENT_STREAM_CODEC_VERSION,
    iv: encodeBase64Url(iv),
    data: encodeBase64Url(data),
  };
}

function decryptPayload(event: AgentStreamEncEvent, aesKey: Buffer): Buffer {
  const iv = decodeBase64Url(event.iv);
  const packed = decodeBase64Url(event.data);
  if (packed.length < GCM_TAG_BYTES) {
    throw new Error("Invalid encrypted payload");
  }
  const tag = packed.subarray(packed.length - GCM_TAG_BYTES);
  const encrypted = packed.subarray(0, packed.length - GCM_TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", aesKey, iv);
  decipher.setAuthTag(tag);
  const compressed = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return gunzipSync(compressed);
}

export type AgentStreamServerSession = {
  cryptoInitEvent: () => AgentStreamCryptoInitEvent;
  encode: (event: Record<string, unknown>) => AgentStreamEncEvent;
  decodeForTest: (event: AgentStreamEncEvent) => Record<string, unknown>;
};

export function isAgentStreamSecureEnabled(): boolean {
  const flag = process.env.AGENT_STREAM_SECURE?.trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "off") return false;
  return true;
}

export function tryCreateAgentStreamServerSession(
  clientPublicKeySpkiBase64Url: unknown
): AgentStreamServerSession | null {
  if (!isAgentStreamSecureEnabled()) return null;
  if (typeof clientPublicKeySpkiBase64Url !== "string" || !clientPublicKeySpkiBase64Url.trim()) {
    return null;
  }
  try {
    return createAgentStreamServerSession(clientPublicKeySpkiBase64Url.trim());
  } catch {
    return null;
  }
}

export function createAgentStreamServerSession(
  clientPublicKeySpkiBase64Url: string
): AgentStreamServerSession {
  const clientPublicKey = importSpkiPublicKey(clientPublicKeySpkiBase64Url);
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: EC_CURVE });
  const sharedSecret = diffieHellman({ privateKey, publicKey: clientPublicKey });
  const aesKey = deriveAesKey(sharedSecret);
  const serverPublicKeySpki = encodeBase64Url(
    publicKey.export({ format: "der", type: "spki" }) as Buffer
  );

  return {
    cryptoInitEvent: () => ({
      type: "crypto_init",
      v: AGENT_STREAM_CODEC_VERSION,
      serverPublicKey: serverPublicKeySpki,
    }),
    encode: (event) => {
      const plaintext = Buffer.from(JSON.stringify(event), "utf8");
      return encryptPayload(plaintext, aesKey);
    },
    decodeForTest: (event) => {
      const json = decryptPayload(event, aesKey).toString("utf8");
      return JSON.parse(json) as Record<string, unknown>;
    },
  };
}

export function exportSpkiFromGeneratedKeyPair(): {
  privateKeyPkcs8: Buffer;
  publicKeySpkiBase64Url: string;
} {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: EC_CURVE });
  const pkcs8 = privateKey.export({ format: "der", type: "pkcs8" }) as Buffer;
  const spki = publicKey.export({ format: "der", type: "spki" }) as Buffer;
  return {
    privateKeyPkcs8: pkcs8,
    publicKeySpkiBase64Url: encodeBase64Url(spki),
  };
}

export function createAgentStreamClientSessionForTest(
  privateKeyPkcs8: Buffer,
  serverPublicKeySpkiBase64Url: string
): {
  decode: (event: AgentStreamEncEvent) => Record<string, unknown>;
} {
  const privateKey = createPrivateKey({ key: privateKeyPkcs8, format: "der", type: "pkcs8" });
  const serverPublicKey = importSpkiPublicKey(serverPublicKeySpkiBase64Url);
  const sharedSecret = diffieHellman({ privateKey, publicKey: serverPublicKey });
  const aesKey = deriveAesKey(sharedSecret);

  return {
    decode: (event) => {
      const json = decryptPayload(event, aesKey).toString("utf8");
      return JSON.parse(json) as Record<string, unknown>;
    },
  };
}
