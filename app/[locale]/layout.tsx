import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ConditionalFooter } from "@/app/components/ConditionalFooter";
import { ConditionalNav } from "@/app/components/ConditionalNav";
import { ConsoleEasterEgg } from "@/app/components/ConsoleEasterEgg";
import { DynamicFavicon } from "@/app/components/DynamicFavicon";
import { FaviconProvider } from "@/app/contexts/FaviconContext";
import { AuthUserProvider } from "@/app/contexts/AuthUserContext";
import { jetBrainsMono, plusJakarta } from "@/app/fonts";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { routing } from "@/i18n/routing";
import "@/app/globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${plusJakarta.variable} ${jetBrainsMono.variable} min-h-screen bg-background text-foreground antialiased`}
      >
        <ThemeProvider>
          <AuthUserProvider>
            <FaviconProvider>
              <DynamicFavicon />
              <ConsoleEasterEgg />
              <AnalyticsProvider>
                <NextIntlClientProvider messages={messages} locale={locale}>
                  <ConditionalNav />
                  {children}
                  <ConditionalFooter />
                </NextIntlClientProvider>
                <Toaster />
              </AnalyticsProvider>
            </FaviconProvider>
          </AuthUserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
