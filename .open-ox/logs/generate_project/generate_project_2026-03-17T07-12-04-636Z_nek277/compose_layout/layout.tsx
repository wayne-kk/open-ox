import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavigationSection from "@/components/sections/layout_NavigationSection";
import FooterSection from "@/components/sections/layout_FooterSection";
import GlobalNavSection from "@/components/sections/layout_GlobalNavSection";
import GlobalFooterSection from "@/components/sections/layout_GlobalFooterSection";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ghibli World: The Miyazaki Collection",
  description: "Experience the magic of Ghibli World: The Miyazaki Collection",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NavigationSection />
        <GlobalNavSection />
        {children}
        <GlobalFooterSection />
        <FooterSection />
      </body>
    </html>
  );
}
