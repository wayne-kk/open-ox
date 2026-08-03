import { DocsSidebar } from "./DocsSidebar";
import type { Metadata } from "next";
import { productPageTitle } from "@/lib/seo/productTitles";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return { title: productPageTitle("docs", (await params).locale) };
}

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen ">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex gap-12 py-10">
          <DocsSidebar />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
