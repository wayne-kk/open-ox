import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { ConsoleEasterEgg } from "@/app/components/ConsoleEasterEgg";
import { DynamicFavicon } from "@/app/components/DynamicFavicon";
import { FaviconProvider } from "@/app/contexts/FaviconContext";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AuthUserProvider } from "@/app/contexts/AuthUserContext";
import { getSiteOrigin } from "@/lib/seo/siteUrl";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteOrigin()),
  title: {
    default: "Open-OX",
    template: "%s",
  },
  description:
    "AI-powered website builder — describe your idea, get a live site in minutes.",
  openGraph: {
    type: "website",
    siteName: "Open-OX",
    images: [{ url: "/og/default.png", width: 1200, height: 630, alt: "Open-OX" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og/default.png"],
  },
};

/**
 * Stable shell: theme + chrome providers live here so locale navigations
 * (`/settings` ↔ `/en/settings`) do not remount next-themes and flash.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${plusJakarta.variable} ${jetBrainsMono.variable} min-h-screen bg-background text-foreground antialiased`}
      >
        <ThemeProvider>
          <AuthUserProvider>
            <FaviconProvider>
              <DynamicFavicon />
              <ConsoleEasterEgg />
              <AnalyticsProvider>{children}</AnalyticsProvider>
            </FaviconProvider>
          </AuthUserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
