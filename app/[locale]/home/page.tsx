import { setRequestLocale } from "next-intl/server";
import { HomeMarketingPage } from "../HomeMarketingPage";
import { buildMarketingMetadata } from "@/lib/seo/marketingMetadata";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return buildMarketingMetadata({
    locale,
    pathname: "/home",
    seoKey: "home",
    canonicalPathname: "/",
  });
}

/**
 * Marketing homepage for signed-in users (and anyone).
 * Logged-out `/` shows the same page; logged-in `/` redirects to `/dashboard` via proxy.
 */
export default async function HomeMarketingRoute({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HomeMarketingPage />;
}
