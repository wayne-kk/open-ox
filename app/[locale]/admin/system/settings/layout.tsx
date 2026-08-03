import { adminPageTitle } from "@/lib/seo/productTitles";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return { title: adminPageTitle("settings", (await params).locale) };
}
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
