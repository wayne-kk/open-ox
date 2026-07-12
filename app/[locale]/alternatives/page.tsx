import { setRequestLocale } from "next-intl/server";
import { AlternativesPage } from "@/app/components/ComparePages";
import { buildMarketingMetadata } from "@/lib/seo/marketingMetadata";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return buildMarketingMetadata({
    locale,
    pathname: "/alternatives",
    seoKey: "alternatives",
  });
}

export default async function AlternativesRoute({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AlternativesPage locale={locale} />;
}
