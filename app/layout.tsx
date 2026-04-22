import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk, Syne } from "next/font/google";
import { ConditionalFooter } from "./components/ConditionalFooter";
import { ConditionalNav } from "./components/ConditionalNav";
import { FaviconProvider } from "./contexts/FaviconContext";
import { DynamicFavicon } from "./components/DynamicFavicon";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
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
        className={`${spaceGrotesk.variable} ${inter.variable} ${jetBrainsMono.variable} ${syne.variable} min-h-screen bg-background text-foreground antialiased`}
      >
        <FaviconProvider>
          <DynamicFavicon />
          <ConditionalNav />
          {children}
          <ConditionalFooter />
        </FaviconProvider>
      </body>
    </html>
  );
}
