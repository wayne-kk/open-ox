/**
 * Post-processes raw viewport JPEGs into gallery covers: full-bleed frame fill
 * with a light inward vignette for depth (no letterboxing).
 */

import { requireFromProject } from "@/lib/requireFromProject";

type SharpModule = typeof import("sharp");

function loadSharp(): SharpModule {
  return requireFromProject<SharpModule>("sharp");
}

export type PolishCoverDimensions = {
  width: number;
  height: number;
};

/** Content fills the frame edge-to-edge — gallery cards crop with object-cover. */
const CONTENT_SCALE = 1;

function cinematicOverlaySvg(w: number, h: number): Buffer {
  const svg = `
<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="oxV" cx="50%" cy="46%" r="74%">
      <stop offset="0%" stop-color="#000" stop-opacity="0"/>
      <stop offset="58%" stop-color="#000" stop-opacity="0"/>
      <stop offset="82%" stop-color="#000" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.72"/>
    </radialGradient>
    <linearGradient id="oxL" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#000" stop-opacity="0.2"/>
      <stop offset="10%" stop-color="#000" stop-opacity="0"/>
      <stop offset="90%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.24"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#oxV)"/>
  <rect width="100%" height="100%" fill="url(#oxL)"/>
</svg>`.trim();
  return Buffer.from(svg);
}

/**
 * Applies polish to a JPEG buffer. Throws if `sharp` cannot process the image;
 * callers may catch and fall back to the raw screenshot.
 */
export async function polishCoverJpeg(rawJpeg: Buffer, dimensions: PolishCoverDimensions): Promise<Buffer> {
  const sharp = loadSharp();
  const { width: fw, height: fh } = dimensions;
  const iw = Math.round(fw * CONTENT_SCALE);
  const ih = Math.round(fh * CONTENT_SCALE);
  const left = Math.floor((fw - iw) / 2);
  const top = Math.floor((fh - ih) / 2);

  const scaled = await sharp(rawJpeg).resize(iw, ih, { fit: "fill" }).toBuffer();

  const overlay = await sharp(cinematicOverlaySvg(fw, fh)).png().toBuffer();

  return sharp({
    create: {
      width: fw,
      height: fh,
      channels: 3,
      background: { r: 5, g: 7, b: 12 },
    },
  })
    .composite([
      { input: scaled, left, top },
      { input: overlay, blend: "over" },
    ])
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}
