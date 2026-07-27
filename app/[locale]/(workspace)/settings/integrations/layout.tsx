import type { Metadata } from "next";
import type { ReactNode } from "react";
import { productPageTitle } from "@/lib/seo/productTitles";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return {
    title: productPageTitle("integrations", (await params).locale),
    robots: { index: false, follow: false },
  };
}

export default function IntegrationsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
