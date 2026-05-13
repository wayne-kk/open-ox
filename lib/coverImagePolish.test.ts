import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { polishCoverJpeg } from "./coverImagePolish";

describe("polishCoverJpeg", () => {
  it("outputs jpeg at target dimensions", async () => {
    const width = 1480;
    const height = 960;
    const raw = await sharp({
      create: { width, height, channels: 3, background: "#1a1f2e" },
    })
      .jpeg()
      .toBuffer();

    const out = await polishCoverJpeg(raw, { width, height });
    const meta = await sharp(out).metadata();

    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(width);
    expect(meta.height).toBe(height);
  });
});
