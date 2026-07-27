import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { getProject } from "@/lib/projectManager";
import { studioPageTitle } from "@/lib/seo/productTitles";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}): Promise<Metadata> {
  const { locale, projectId } = await params;
  const session = await getSessionUser();
  const project = session
    ? await getProject(session.supabase, projectId)
    : null;
  return {
    title: studioPageTitle(project?.name, locale),
    robots: { index: false, follow: false },
  };
}

export default function StudioLayout({ children }: { children: ReactNode }) {
  return children;
}
