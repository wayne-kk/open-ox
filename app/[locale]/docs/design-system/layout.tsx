import { docsPageTitle } from "@/lib/seo/productTitles";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return { title: docsPageTitle("designSystem", (await params).locale) };
}
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
