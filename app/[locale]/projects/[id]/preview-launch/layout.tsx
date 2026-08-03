import { getSessionUser } from "@/lib/auth/session";
import { getProject } from "@/lib/projectManager";
import { previewPageTitle } from "@/lib/seo/productTitles";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const session = await getSessionUser();
  const project = session ? await getProject(session.supabase, id) : null;
  return {
    title: previewPageTitle(project?.name, locale),
    robots: { index: false, follow: false },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
