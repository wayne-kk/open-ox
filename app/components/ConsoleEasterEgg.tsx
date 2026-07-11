"use client";

import { useEffect } from "react";

// Plain `#` glyphs — Unicode box chars + console text-shadow fragment into junk.
const OX = [
  " #######   ##   ##",
  "##     ##   ## ##",
  "##     ##    ###",
  "##     ##    ###",
  "##     ##   ## ##",
  " #######   ##   ##",
].join("\n");

declare global {
  interface Window {
    __openOxConsolePrinted?: boolean;
  }
}

export function ConsoleEasterEgg() {
  useEffect(() => {
    if (window.__openOxConsolePrinted) return;
    window.__openOxConsolePrinted = true;

    console.log(
      `%c${OX}`,
      [
        "font-family: Menlo, Monaco, Consolas, monospace",
        "font-size: 13px",
        "line-height: 1.2",
        "font-weight: 700",
        "color: #00ff88",
        "text-shadow: 0 0 8px #00ff88, 0 0 18px #00d4ff",
      ].join(";"),
    );
  }, []);

  return null;
}
