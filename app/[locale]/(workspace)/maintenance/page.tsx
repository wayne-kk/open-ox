import { ArrowLeft, Wrench } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { isProjectCreationMaintenance } from "@/lib/projectCreationMaintenance.server";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function MaintenancePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await isProjectCreationMaintenance())) {
    redirect("/dashboard?mine=1&folder=all");
  }
  const isEnglish = locale === "en";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-16 sm:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:48px_48px] opacity-[0.16] [mask-image:radial-gradient(circle_at_center,black,transparent_72%)]"
      />

      <section className="relative w-full max-w-2xl border-y border-border py-12 sm:py-16">
        <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary shadow-[var(--box-shadow-neon-sm)]">
          <Wrench className="h-5 w-5" strokeWidth={1.75} />
        </div>

        <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          {isEnglish ? "Maintenance in progress" : "维护进行中"}
        </div>

        <h1 className="mt-5 font-heading text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
          {isEnglish ? "Project creation is temporarily paused" : "项目生成服务正在维护"}
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
          {isEnglish
            ? "We are performing server maintenance. Creating new projects is temporarily unavailable, while your existing projects and all other features remain available."
            : "我们正在进行服务器维护，暂时无法创建新项目。已有项目和其他功能仍可正常使用。"}
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-4">
          <Link
            href="/dashboard?mine=1&folder=all"
            className="defi-button inline-flex items-center gap-2 px-5 py-2.5 text-sm"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            {isEnglish ? "Back to projects" : "返回我的项目"}
          </Link>
          <span className="text-xs text-muted-foreground">
            {isEnglish ? "Please try again later" : "请稍后再试"}
          </span>
        </div>
      </section>
    </main>
  );
}
