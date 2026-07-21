import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function encryptionKeyBytes(): Buffer {
  const raw = process.env.SUPABASE_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw || raw.length < 16) {
    throw new Error("SUPABASE_TOKEN_ENCRYPTION_KEY must be set (min 16 chars)");
  }
  return createHash("sha256").update(raw).digest();
}

/** Encrypt a secret for DB storage. Format: `v1:<iv_b64>:<tag_b64>:<cipher_b64>`. */
export function encryptSecret(plaintext: string): string {
  const key = encryptionKeyBytes();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${enc.toString("base64url")}`;
}

export function decryptSecret(payload: string): string {
  const key = encryptionKeyBytes();
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Invalid encrypted secret format");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64!, "base64url");
  const tag = Buffer.from(tagB64!, "base64url");
  const data = Buffer.from(dataB64!, "base64url");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
