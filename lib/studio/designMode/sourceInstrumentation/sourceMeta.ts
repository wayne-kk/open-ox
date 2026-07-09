export type OxTextKind = "static" | "dynamic" | "mixed" | "none";
export type OxClassKind = "static" | "dynamic" | "none";

export interface OxSourceMeta {
  version: 1;
  file: string;
  line: number;
  column: number;
  tag: string;
  textKind: OxTextKind;
  classKind: OxClassKind;
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf-8");
}

export function encodeOxSourceMeta(meta: OxSourceMeta): string {
  return toBase64Url(JSON.stringify(meta));
}

export function decodeOxSourceMeta(value: string | null | undefined): OxSourceMeta | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(value)) as Partial<OxSourceMeta>;
    if (parsed.version !== 1) return null;
    if (!parsed.file || !parsed.tag || typeof parsed.line !== "number" || typeof parsed.column !== "number") {
      return null;
    }
    if (!parsed.textKind || !parsed.classKind) return null;
    return parsed as OxSourceMeta;
  } catch {
    return null;
  }
}
