import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import NavigationSection from "@/components/sections/layout_NavigationSection";
import FooterSection from "@/components/sections/layout_FooterSection";
import { OpenOxPreviewBridge } from "@/components/open-ox/OpenOxPreviewBridge";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ghibli World: Miyazaki Legacy Platform",
  description:
    "A poetic journey through the legacy of Hayao Miyazaki and Studio Ghibli.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <OpenOxPreviewBridge />
        <NavigationSection />
        {children}
        <FooterSection />
      </body>
    </html>
  );
}
