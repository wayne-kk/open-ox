import type { Metadata } from "next";
import type { ReactNode } from "react";
import { productPageTitle } from "@/lib/seo/productTitles";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return {
    title: productPageTitle("appearance", (await params).locale),
    robots: { index: false, follow: false },
  };
}

export default function AppearanceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
