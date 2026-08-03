import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { getProject } from "@/lib/projectManager";
import { projectPageTitle } from "@/lib/seo/productTitles";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const session = await getSessionUser();
  const project = session ? await getProject(session.supabase, id) : null;
  return {
    title: projectPageTitle(project?.name, locale),
    robots: { index: false, follow: false },
  };
}

export default function ProjectLayout({ children }: { children: ReactNode }) {
  return children;
}
