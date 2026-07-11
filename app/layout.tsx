import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { ConditionalFooter } from "./components/ConditionalFooter";
import { ConditionalNav } from "./components/ConditionalNav";
import { ConsoleEasterEgg } from "./components/ConsoleEasterEgg";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { FaviconProvider } from "./contexts/FaviconContext";
import { DynamicFavicon } from "./components/DynamicFavicon";
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
  title: "Open-OX Studio",
  description: "AI-powered website builder — describe your idea, get a live site in seconds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body
        className={`${plusJakarta.variable} ${jetBrainsMono.variable} min-h-screen bg-background text-foreground antialiased`}
      >
        <FaviconProvider>
          <DynamicFavicon />
          <ConsoleEasterEgg />
          <AnalyticsProvider>
            <ConditionalNav />
            {children}
            <ConditionalFooter />
          </AnalyticsProvider>
        </FaviconProvider>
      </body>
    </html>
  );
}
