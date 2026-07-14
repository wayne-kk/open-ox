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
      {/* CJK locals after next/font so cover capture / Linux hosts are not stuck on Inter Fallback (Arial) tofu */}
      <body
        className={inter.className}
        style={{
          fontFamily: `${inter.style.fontFamily}, "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif`,
        }}
      >
        <OpenOxPreviewBridge />
        <NavigationSection />
        {children}
        <FooterSection />
      </body>
    </html>
  );
}
