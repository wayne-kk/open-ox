import type { Metadata } from "next";
import type { ReactNode } from "react";
import { productPageTitle } from "@/lib/seo/productTitles";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return { title: productPageTitle("community", (await params).locale) };
}

export default function CommunityLayout({ children }: { children: ReactNode }) {
  return children;
}
