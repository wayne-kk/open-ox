import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSiteOrigin } from "@/lib/seo/siteUrl";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteOrigin()),
  title: {
    default: "Open-OX",
    template: "%s",
  },
  description:
    "AI-powered website builder — describe your idea, get a live site in minutes.",
  icons: {
    icon: [
      { url: "/brand-mark.svg", type: "image/svg+xml" },
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "48x48" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/favicon-48.png", sizes: "48x48", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    siteName: "Open-OX",
    images: [{ url: "/og/default.png", width: 1200, height: 630, alt: "Open-OX" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og/default.png"],
  },
  verification: {
    other: {
      "baidu-site-verification": "codeva-EvYxD6iL9T",
    },
  },
};

/**
 * Passthrough root: `<html lang>` lives in `[locale]/layout` so SSR matches the URL locale.
 * Providers that must survive locale switches also live there (next-themes uses localStorage).
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
