import { setRequestLocale } from "next-intl/server";
import { CompareHub } from "@/app/components/ComparePages";
import { buildMarketingMetadata } from "@/lib/seo/marketingMetadata";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return buildMarketingMetadata({
    locale,
    pathname: "/compare",
    seoKey: "compare",
  });
}

export default async function CompareIndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CompareHub locale={locale} />;
}
