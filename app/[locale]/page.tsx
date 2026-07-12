import { setRequestLocale } from "next-intl/server";
import { HomeMarketingPage } from "./HomeMarketingPage";
import { buildMarketingMetadata } from "@/lib/seo/marketingMetadata";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return buildMarketingMetadata({
    locale,
    pathname: "/",
    seoKey: "home",
  });
}

/** Marketing home for logged-out visitors. Logged-in users are redirected in proxy.ts. */
export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HomeMarketingPage />;
}
