import { describe, expect, it } from "vitest";
import { parseProjectsFilesHash } from "./previewFingerprintDb";

describe("parseProjectsFilesHash", () => {
  it("parses legacy file-only hash", () => {
    expect(parseProjectsFilesHash("abcd1234ef567890")).toEqual({
      filesFingerprint: "abcd1234ef567890",
      storageOriginFingerprint: null,
    });
  });

  it("parses storage compound hash", () => {
    expect(parseProjectsFilesHash("aaaabbbbccccdddd:0123456789abcdef")).toEqual({
      filesFingerprint: "aaaabbbbccccdddd",
      storageOriginFingerprint: "0123456789abcdef",
    });
  });

  it("handles first colon only (origin part is opaque)", () => {
    expect(parseProjectsFilesHash("aa:bb:cc")).toEqual({
      filesFingerprint: "aa",
      storageOriginFingerprint: "bb:cc",
    });
  });

  it("handles null and empty", () => {
    expect(parseProjectsFilesHash(null)).toEqual({
      filesFingerprint: null,
      storageOriginFingerprint: null,
    });
    expect(parseProjectsFilesHash("")).toEqual({
      filesFingerprint: null,
      storageOriginFingerprint: null,
    });
  });
});
