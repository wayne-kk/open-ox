import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import GlobalNavSection from "@/components/sections/layout_GlobalNavSection";
import GlobalFooterSection from "@/components/sections/layout_GlobalFooterSection";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Marvel Cinematic Universe: Movie Launch Experience",
  description:
    "Experience the next chapter of the MCU with exclusive content, trailers, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <GlobalNavSection />
        {children}
        <GlobalFooterSection />
      </body>
    </html>
  );
}
