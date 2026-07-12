import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { PricingPageClient } from "./PricingPageClient";
import { buildMarketingMetadata } from "@/lib/seo/marketingMetadata";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return buildMarketingMetadata({
    locale,
    pathname: "/pricing",
    seoKey: "pricing",
  });
}

export default async function PricingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
          Loading pricing…
        </div>
      }
    >
      <PricingPageClient />
    </Suspense>
  );
}
