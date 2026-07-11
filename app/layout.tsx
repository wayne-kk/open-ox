import type { Metadata } from "next";
import { JetBrains_Mono, Orbitron, Share_Tech_Mono } from "next/font/google";
import { ConditionalFooter } from "./components/ConditionalFooter";
import { ConditionalNav } from "./components/ConditionalNav";
import { ConsoleEasterEgg } from "./components/ConsoleEasterEgg";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { FaviconProvider } from "./contexts/FaviconContext";
import { DynamicFavicon } from "./components/DynamicFavicon";
import "./globals.css";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

const shareTechMono = Share_Tech_Mono({
  variable: "--font-share-tech",
  subsets: ["latin"],
  weight: "400",
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
        className={`${orbitron.variable} ${jetBrainsMono.variable} ${shareTechMono.variable} min-h-screen bg-background text-foreground antialiased`}
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
