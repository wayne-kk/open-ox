import localFont from "next/font/local";

/**
 * Self-hosted Latin faces — build must not call fonts.googleapis.com
 * (Tencent CVM / restricted networks fail Turbopack `next/font/google` fetch).
 */
export const plusJakarta = localFont({
  src: [
    {
      path: "./plus-jakarta-sans-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./plus-jakarta-sans-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./plus-jakarta-sans-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "./plus-jakarta-sans-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-jakarta",
  display: "swap",
});

export const jetBrainsMono = localFont({
  src: [
    {
      path: "./jetbrains-mono-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./jetbrains-mono-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./jetbrains-mono-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-jetbrains",
  display: "swap",
});
