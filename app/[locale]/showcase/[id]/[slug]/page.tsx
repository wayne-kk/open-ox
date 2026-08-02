import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { buildStaticPreviewUrl } from "@/lib/previewOrigin";
import { projectCoverDisplayUrl } from "@/lib/projectCoverUrls";
import { getSiteOrigin } from "@/lib/seo/siteUrl";
import { getPublicShowcaseProject } from "@/lib/seo/projectSearchRepository";
import {
  indexableProjectUrl,
  isProjectIndexable,
  projectSeoSlug,
  projectShowcasePath,
} from "@/lib/seo/publishedProject";

type Props = { params: Promise<{ locale: string; id: string; slug: string }> };

function descriptionFor(project: { seoDescription?: string | null; userPrompt?: string | null; name: string }) {
  const value = project.seoDescription?.trim() || project.userPrompt?.trim();
  return (value || `Explore ${project.name}, a project published with Open OX.`).slice(0, 160);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id, slug } = await params;
  const project = await getPublicShowcaseProject(id);
  if (!project) return { title: "Project not found", robots: { index: false, follow: false } };

  const canonicalSlug = project.seoSlug?.trim() || projectSeoSlug(project.name);
  const origin = getSiteOrigin();
  const canonical = indexableProjectUrl(project, locale, origin);
  const description = descriptionFor(project);
  const cover = new URL(projectCoverDisplayUrl(project.id, project.coverImageUpdatedAt), origin).toString();

  return {
    title: project.seoTitle?.trim() || `${project.name} | Open OX`,
    description,
    alternates: { canonical },
    robots: { index: slug === canonicalSlug && isProjectIndexable(project), follow: true },
    openGraph: {
      type: "website",
      url: canonical,
      title: project.seoTitle?.trim() || project.name,
      description,
      images: [{ url: cover, alt: project.name }],
    },
    twitter: { card: "summary_large_image", title: project.name, description, images: [cover] },
  };
}

export default async function ShowcaseProjectPage({ params }: Props) {
  const { locale, id, slug } = await params;
  const project = await getPublicShowcaseProject(id);
  if (!project) notFound();

  const canonicalSlug = project.seoSlug?.trim() || projectSeoSlug(project.name);
  if (slug !== canonicalSlug) {
    const path = projectShowcasePath({ ...project, seoSlug: canonicalSlug });
    permanentRedirect(locale === "zh-CN" ? path : `/${locale}${path}`);
  }

  const origin = getSiteOrigin();
  const canonical = indexableProjectUrl(project, locale, origin);
  const description = descriptionFor(project);
  const cover = new URL(projectCoverDisplayUrl(project.id, project.coverImageUpdatedAt), origin).toString();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.name,
    description,
    url: canonical,
    image: cover,
    dateCreated: project.createdAt,
    dateModified: project.seoUpdatedAt || project.updatedAt,
    author: project.ownerUsername
      ? { "@type": "Person", name: project.ownerUsername }
      : { "@type": "Organization", name: "Open OX Community" },
    isPartOf: { "@type": "WebSite", name: "Open OX", url: origin },
  };

  return (
    <main className="min-h-screen bg-[#f7f7f4] text-[#171717]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c") }}
      />
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-sm font-semibold">Open OX</Link>
          <Link href={locale === "zh-CN" ? "/community" : `/${locale}/community`} className="text-sm text-black/60 hover:text-black">
            {locale === "zh-CN" ? "浏览社区" : "Explore community"}
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10 lg:py-14">
        <div className="mb-8 max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase text-emerald-700">Open OX Showcase</p>
          <h1 className="text-3xl font-semibold leading-tight sm:text-5xl">{project.name}</h1>
          <p className="mt-4 text-base leading-7 text-black/65">{description}</p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-black/50">
            {project.ownerUsername ? <span>{locale === "zh-CN" ? "作者" : "By"}: {project.ownerUsername}</span> : null}
            <span>{new Date(project.publishedAt || project.createdAt).toLocaleDateString(locale)}</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-black/15 bg-white shadow-sm">
          <iframe
            src={buildStaticPreviewUrl(project.id)}
            title={`${project.name} preview`}
            className="block min-h-[70vh] w-full border-0"
            loading="eager"
          />
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-4 py-8 text-sm text-black/55">
          <span>{locale === "zh-CN" ? "由 Open OX 创建并发布" : "Created and published with Open OX"}</span>
          <Link
            href={`/?utm_source=showcase&utm_medium=referral&utm_campaign=published_project&utm_content=${encodeURIComponent(project.id)}&create=1`}
            className="font-semibold text-black hover:text-emerald-700"
          >
            Made with Open OX
          </Link>
        </footer>
      </section>
    </main>
  );
}
