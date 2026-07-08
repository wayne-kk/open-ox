import { describe, expect, it } from "vitest";
import { patchLayoutForBridge } from "./ensureProjectBridge";

const SAMPLE_LAYOUT = `import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
`;

describe("patchLayoutForBridge", () => {
  it("adds import and bootstrap component", () => {
    const out = patchLayoutForBridge(SAMPLE_LAYOUT);
    expect(out).toContain('import { OpenOxPreviewBridge } from "@/components/open-ox/OpenOxPreviewBridge"');
    expect(out).toContain("<OpenOxPreviewBridge />");
    expect(out.indexOf("OpenOxPreviewBridge")).toBeLessThan(out.indexOf("{children}"));
  });

  it("is idempotent", () => {
    const once = patchLayoutForBridge(SAMPLE_LAYOUT);
    expect(patchLayoutForBridge(once)).toBe(once);
  });
});
