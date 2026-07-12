import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ConditionalFooter } from "@/app/components/ConditionalFooter";
import { ConditionalNav } from "@/app/components/ConditionalNav";
import { DocumentLang } from "@/components/i18n/DocumentLang";
import { routing } from "@/i18n/routing";

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
    <NextIntlClientProvider messages={messages} locale={locale}>
      <DocumentLang locale={locale} />
      <ConditionalNav />
      {children}
      <ConditionalFooter />
    </NextIntlClientProvider>
  );
}
