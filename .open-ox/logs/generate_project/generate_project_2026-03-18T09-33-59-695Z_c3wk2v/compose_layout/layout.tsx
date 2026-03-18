import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import GlobalNavSection from "@/components/sections/layout_GlobalNavSection";
import GlobalFooterSection from "@/components/sections/layout_GlobalFooterSection";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Studio Ghibli Showcase | A Journey Through Wonder",
  description:
    "Experience the ethereal beauty and timeless storytelling of Studio Ghibli's cinematic masterpieces.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} scroll-smooth`}
    >
      <body className="antialiased bg-[#fdfbf7] text-[#2d3436] min-h-screen flex flex-col selection:bg-amber-100 selection:text-amber-900">
        <GlobalNavSection />
        <main className="flex-grow">{children}</main>
        <GlobalFooterSection />
      </body>
    </html>
  );
}
