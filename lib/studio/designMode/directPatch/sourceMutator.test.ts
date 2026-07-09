import { describe, expect, it } from "vitest";

import { patchClassNameOnLine, patchTextInFile, upsertTailwindUtility } from "./sourceMutator";

describe("upsertTailwindUtility", () => {
  it("replaces color utility with arbitrary hex", () => {
    const next = upsertTailwindUtility("text-white font-bold", "color", "#ff0000");
    expect(next).toBe("font-bold text-[#ff0000]");
  });

  it("replaces font size without dropping color arbitrary utilities", () => {
    const next = upsertTailwindUtility("text-lg text-[#ff0000]", "fontSize", "24px");
    expect(next).toBe("text-[#ff0000] text-[24px]");
  });

  it("replaces font size with arbitrary px", () => {
    const next = upsertTailwindUtility("text-lg text-white", "fontSize", "24px");
    expect(next).toBe("text-white text-[24px]");
  });

  it("appends padding when missing", () => {
    const next = upsertTailwindUtility("rounded-md", "padding", "12px");
    expect(next).toBe("rounded-md p-[12px]");
  });
});

describe("patchClassNameOnLine", () => {
  it("patches double-quoted className", () => {
    const line = '  <h1 className="text-white text-lg">Title</h1>';
    const result = patchClassNameOnLine(line, (classes) =>
      upsertTailwindUtility(classes, "color", "#00ff00")
    );
    expect(result?.newLine).toContain('className="text-lg text-[#00ff00]"');
  });

  it("returns null when no className on line", () => {
    expect(patchClassNameOnLine("<span>Hello</span>", (c) => c)).toBeNull();
  });
});

describe("patchTextInFile", () => {
  it("returns replacement pair for unique text", () => {
    const content = '<p className="x">Hello world</p>';
    const result = patchTextInFile(content, "Hello world", "Hi there");
    expect(result).toEqual({ old_string: "Hello world", new_string: "Hi there" });
  });

  it("errors on ambiguous text", () => {
    const content = "Hello\nHello";
    const result = patchTextInFile(content, "Hello", "Hi");
    expect(result).toEqual({ error: 'Text "Hello" appears 2 times — cannot patch safely' });
  });
});
