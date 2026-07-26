import { ArrowLeft, Check, Pause } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { BrandMark } from "@/app/components/BrandMark";
import { isProjectCreationMaintenance } from "@/lib/projectCreationMaintenance.server";
import { MaintenanceEngineGraphic } from "./MaintenanceEngineGraphic";

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
    <main className="relative min-h-screen overflow-hidden bg-background px-5 py-6 sm:px-8 lg:px-12">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border/70">
          <div className="flex items-center gap-2.5">
            <BrandMark size={26} />
            <span className="font-heading text-xs font-bold text-foreground">OPEN-OX</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
            {isEnglish ? "System maintenance" : "系统维护"}
          </div>
        </header>

        <section className="grid flex-1 items-center gap-10 py-10 md:grid-cols-[minmax(0,0.92fr)_minmax(380px,1.08fr)] md:gap-8 lg:py-12">
          <div className="relative z-10 max-w-xl">
            <p className="font-mono text-xs text-primary">
              {isEnglish ? "GENERATION ENGINE / PAUSED" : "生成引擎 / 暂停服务"}
            </p>
            <h1 className="mt-5 max-w-lg font-heading text-4xl font-semibold leading-[1.15] text-foreground sm:text-5xl">
              {isEnglish ? "Project creation is temporarily paused" : "生成引擎正在维护"}
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground sm:text-base">
              {isEnglish
                ? "We are upgrading the generation service. Your existing projects and the rest of the workspace remain available."
                : "我们正在升级项目生成服务。维护期间无法创建新项目，已有项目与工作台其他功能可正常使用。"}
            </p>

            <div className="mt-8 grid max-w-lg grid-cols-1 border-y border-border/70 sm:grid-cols-2 sm:divide-x sm:divide-border/70">
              <div className="flex items-center gap-3 py-4 sm:pr-5">
                <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                  <Pause className="h-3.5 w-3.5" fill="currentColor" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">{isEnglish ? "Project creation" : "项目生成"}</p>
                  <p className="mt-0.5 text-sm font-medium text-foreground">{isEnglish ? "Paused" : "已暂停"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 py-4 sm:pl-5">
                <span className="grid h-8 w-8 place-items-center rounded-md bg-emerald-500/10 text-emerald-400">
                  <Check className="h-4 w-4" strokeWidth={2} />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">{isEnglish ? "Existing projects" : "已有项目"}</p>
                  <p className="mt-0.5 text-sm font-medium text-foreground">{isEnglish ? "Available" : "正常使用"}</p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/dashboard?mine=1&folder=all"
                className="defi-button inline-flex items-center gap-2 px-5 py-2.5 text-sm"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
                {isEnglish ? "Back to projects" : "返回我的项目"}
              </Link>
              <span className="text-xs text-muted-foreground">
                {isEnglish ? "Please try again later" : "恢复后即可继续创建"}
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[560px] md:max-w-none">
            <div aria-hidden className="absolute inset-12 rounded-full bg-primary/5 blur-3xl" />
            <MaintenanceEngineGraphic />
          </div>
        </section>
      </div>
    </main>
  );
}
