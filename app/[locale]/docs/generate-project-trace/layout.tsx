import { docsPageTitle } from "@/lib/seo/productTitles";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return { title: docsPageTitle("generationTrace", (await params).locale) };
}
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
