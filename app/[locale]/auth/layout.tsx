import type { Metadata } from "next";
import type { ReactNode } from "react";
import { productPageTitle } from "@/lib/seo/productTitles";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: productPageTitle("auth", locale),
    robots: { index: false, follow: false },
  };
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
