import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center px-6 py-24 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">404</p>
      <h1 className="mt-4 font-heading text-3xl font-semibold tracking-[-0.03em]">
        {t("title")}
      </h1>
      <p className="mt-3 text-[14px] text-muted-foreground">{t("body")}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="defi-button h-10 px-5 text-[13px]">
          {t("home")}
        </Link>
        <Link href="/pricing" className="defi-button-outline h-10 px-5 text-[13px]">
          {t("pricing")}
        </Link>
        <Link href="/compare" className="defi-button-outline h-10 px-5 text-[13px]">
          {t("compare")}
        </Link>
      </div>
    </main>
  );
}
