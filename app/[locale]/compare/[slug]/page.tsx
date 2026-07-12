import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { CompetitorComparePage } from "@/app/components/ComparePages";
import { COMPETITORS, getCompetitor } from "@/lib/seo/competitors";
import { buildMarketingMetadata } from "@/lib/seo/marketingMetadata";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

const SEO_KEY = {
  lovable: "compareLovable",
  v0: "compareV0",
  base44: "compareBase44",
} as const;

export function generateStaticParams() {
  return COMPETITORS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const competitor = getCompetitor(slug);
  if (!competitor) return {};
  return buildMarketingMetadata({
    locale,
    pathname: `/compare/${slug}`,
    seoKey: SEO_KEY[competitor.slug],
  });
}

export default async function CompareSlugPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const competitor = getCompetitor(slug);
  if (!competitor) notFound();
  return <CompetitorComparePage locale={locale} competitor={competitor} />;
}
