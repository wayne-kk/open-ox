import { describe, expect, it } from "vitest";
import { hashRawWorkspaceFile, normalizeWorkspaceText, workspaceContentHash } from "./contentProtocol";

describe("contentProtocol", () => {
  it("normalizes CRLF to LF for hashing", () => {
    const a = "a\r\nb";
    const b = "a\nb";
    expect(normalizeWorkspaceText(a)).toBe(b);
    expect(hashRawWorkspaceFile(a)).toBe(hashRawWorkspaceFile(b));
  });

  it("produces stable sha256: prefix", () => {
    expect(workspaceContentHash("x")).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});
