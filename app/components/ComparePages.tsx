import { Link } from "@/i18n/navigation";
import {
  COMPETITORS,
  getCompetitor,
  pickLocale,
  type CompetitorCompare,
} from "@/lib/seo/competitors";

function Disclaimer({ locale }: { locale: string }) {
  return (
    <p className="mt-6 rounded-xl border border-border/80 bg-muted/30 px-4 py-3 text-[12px] leading-relaxed text-muted-foreground">
      {locale === "en"
        ? "Open-OX is not affiliated with, endorsed by, or sponsored by the named products. Brand names are used for nominative comparison only. Feature descriptions reflect public positioning and may change — verify on each vendor’s official site. No competitor logos are used."
        : "Open-OX 与所列产品无附属、背书或赞助关系。品牌名仅用于指名对比。能力描述基于公开定位，可能随版本变化 — 请以各方官网为准。本页不使用竞品 Logo。"}
    </p>
  );
}

export function CompareHub({ locale }: { locale: string }) {
  const isEn = locale === "en";
  return (
    <main className="relative mx-auto min-h-dvh max-w-3xl px-6 py-14 lg:px-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
        // compare
      </p>
      <h1 className="mt-4 font-heading text-3xl font-semibold tracking-[-0.03em] md:text-4xl">
        {isEn ? "Open-OX comparisons" : "Open-OX 对比"}
      </h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
        {isEn
          ? "Straight comparisons for people evaluating AI website builders. We state what each tool is strong at, then where Open-OX differs — without pretending to be them."
          : "面向正在评估 AI 建站工具的读者：先写清对方擅长什么，再说明 Open-OX 的差异 — 不做冒充、不抹黑。"}
      </p>
      <ul className="mt-10 space-y-3">
        {COMPETITORS.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/compare/${c.slug}`}
              className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 text-[15px] font-medium transition-colors hover:border-primary/40 hover:text-primary"
            >
              <span>Open-OX vs {c.name}</span>
              <span className="font-mono text-[11px] text-muted-foreground">→</span>
            </Link>
          </li>
        ))}
        <li>
          <Link
            href="/alternatives"
            className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 text-[15px] font-medium transition-colors hover:border-primary/40 hover:text-primary"
          >
            <span>
              {isEn
                ? "Alternatives to Lovable, v0, and Base44"
                : "Lovable / v0 / Base44 替代方案"}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">→</span>
          </Link>
        </li>
      </ul>
      <Disclaimer locale={locale} />
      <p className="mt-8">
        <Link href="/pricing" className="text-[13px] text-primary hover:underline">
          {isEn ? "View Open-OX pricing →" : "查看 Open-OX 定价 →"}
        </Link>
      </p>
    </main>
  );
}

export function CompetitorComparePage({
  locale,
  competitor,
}: {
  locale: string;
  competitor: CompetitorCompare;
}) {
  const isEn = locale === "en";
  return (
    <main className="relative mx-auto min-h-dvh max-w-3xl px-6 py-14 lg:px-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
        // vs {competitor.slug}
      </p>
      <h1 className="mt-4 font-heading text-3xl font-semibold tracking-[-0.03em] md:text-4xl">
        Open-OX vs {competitor.name}
      </h1>
      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
        {isEn ? "Last updated" : "最近更新"} {competitor.lastUpdated}
      </p>
      <p className="mt-6 text-[15px] leading-relaxed text-muted-foreground">
        {pickLocale(competitor.openOxAngle, locale)}
      </p>

      <section className="mt-10">
        <h2 className="text-[18px] font-semibold tracking-[-0.02em]">
          {isEn ? `What ${competitor.name} does well` : `${competitor.name} 擅长什么`}
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
          {pickLocale(competitor.theirStrength, locale)}{" "}
          <a
            href={competitor.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {isEn ? "Official site" : "官网"} ↗
          </a>
        </p>
      </section>

      <section className="mt-12 overflow-x-auto">
        <h2 className="text-[18px] font-semibold tracking-[-0.02em]">
          {isEn ? "Side-by-side" : "对照表"}
        </h2>
        <table className="mt-5 w-full min-w-[36rem] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="py-3 pr-4 font-medium">{isEn ? "Dimension" : "维度"}</th>
              <th className="py-3 pr-4 font-medium">Open-OX</th>
              <th className="py-3 font-medium">{competitor.name}</th>
            </tr>
          </thead>
          <tbody>
            {competitor.rows.map((row) => (
              <tr key={pickLocale(row.dimension, "en")} className="border-b border-border/70 align-top">
                <td className="py-3.5 pr-4 font-medium text-foreground">
                  {pickLocale(row.dimension, locale)}
                </td>
                <td className="py-3.5 pr-4 text-muted-foreground">
                  {pickLocale(row.openOx, locale)}
                </td>
                <td className="py-3.5 text-muted-foreground">
                  {pickLocale(row.other, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-12 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-[14px] font-semibold">
            {isEn ? "Choose Open-OX when…" : "更适合选 Open-OX 若…"}
          </h3>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            {pickLocale(competitor.whenOpenOx, locale)}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-[14px] font-semibold">
            {isEn
              ? `Choose ${competitor.name} when…`
              : `更适合选 ${competitor.name} 若…`}
          </h3>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            {pickLocale(competitor.whenOther, locale)}
          </p>
        </div>
      </section>

      <Disclaimer locale={locale} />

      <div className="mt-10 flex flex-wrap gap-4">
        <Link href="/auth" className="defi-button h-10 px-5 text-[13px]">
          {isEn ? "Try Open-OX" : "试用 Open-OX"}
        </Link>
        <Link
          href="/compare"
          className="defi-button-outline h-10 px-5 text-[13px]"
        >
          {isEn ? "All comparisons" : "全部对比"}
        </Link>
      </div>
    </main>
  );
}

export function AlternativesPage({ locale }: { locale: string }) {
  const isEn = locale === "en";
  return (
    <main className="relative mx-auto min-h-dvh max-w-3xl px-6 py-14 lg:px-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
        // alternatives
      </p>
      <h1 className="mt-4 font-heading text-3xl font-semibold tracking-[-0.03em] md:text-4xl">
        {isEn
          ? "Alternatives to Lovable, v0, and Base44"
          : "Lovable、v0、Base44 的替代选择"}
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
        {isEn
          ? "If you searched for alternatives, you are usually deciding between chat-first builders and engineering-first website pipelines. Open-OX is the latter: describe an idea, get a runnable Next.js site, then iterate in Studio."
          : "搜「替代方案」时，人们通常在「对话优先的构建器」与「工程优先的网站流水线」之间选择。Open-OX 属于后者：描述想法 → 得到可运行的 Next.js 站点 → 在 Studio 迭代。"}
      </p>
      <ol className="mt-10 list-decimal space-y-6 pl-5 text-[14px] leading-relaxed text-muted-foreground">
        <li>
          <span className="font-medium text-foreground">Open-OX</span> —{" "}
          {isEn
            ? "Full-site generation with build verification, Design Mode, community remix, and optional BYO Vercel deploy."
            : "整站生成 + 构建验证、Design Mode、社区 Remix，以及可选推送到自己的 Vercel。"}{" "}
          <Link href="/auth" className="text-primary hover:underline">
            {isEn ? "Start free" : "免费开始"}
          </Link>
        </li>
        {COMPETITORS.map((c) => (
          <li key={c.slug}>
            <a
              href={c.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:text-primary"
            >
              {c.name}
            </a>{" "}
            — {pickLocale(c.theirStrength, locale)}{" "}
            <Link href={`/compare/${c.slug}`} className="text-primary hover:underline">
              {isEn ? "vs Open-OX" : "对比 Open-OX"}
            </Link>
          </li>
        ))}
      </ol>
      <Disclaimer locale={locale} />
    </main>
  );
}

export { getCompetitor };
