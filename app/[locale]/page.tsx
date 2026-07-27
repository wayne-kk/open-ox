import { setRequestLocale } from "next-intl/server";
import { HomeMarketingPage } from "./HomeMarketingPage";
import { buildMarketingMetadata } from "@/lib/seo/marketingMetadata";
import { getSiteOrigin } from "@/lib/seo/siteUrl";

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
  const origin = getSiteOrigin();
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${origin}/#organization`,
        name: "Open-OX",
        url: origin,
        logo: `${origin}/favicon.png`,
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        name: "Open-OX",
        alternateName: "Open-OX AI Website Builder",
        url: origin,
        inLanguage: ["en", "zh-CN"],
        publisher: { "@id": `${origin}/#organization` },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <HomeMarketingPage />
    </>
  );
}
