import { Suspense } from "react";
import { MessageSquareText, Rocket, Workflow } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { DeferredGLSLHills } from "@/app/components/DeferredGLSLHills";
import { HeroVisual } from "@/app/components/HeroVisual";
import { HeroPrompt } from "@/app/components/HeroPrompt";
import {
  HomeCommunityPreview,
  HomeCommunitySectionHeader,
} from "@/app/components/HomeCommunityPreview";
import { PipelineDisclosure } from "@/app/components/PipelineDisclosure";

export async function HomeMarketingPage() {
  const t = await getTranslations("landing");

  const storySteps = [
    {
      icon: MessageSquareText,
      title: t("step1Title"),
      body: t("step1Body"),
    },
    {
      icon: Workflow,
      title: t("step2Title"),
      body: t("step2Body"),
    },
    {
      icon: Rocket,
      title: t("step3Title"),
      body: t("step3Body"),
    },
  ];

  return (
    <main className="relative isolate min-h-dvh overflow-hidden">
      <section className="relative flex min-h-[min(100dvh,1120px)] flex-col items-center justify-center px-6 pb-44 pt-20 sm:pb-60 sm:pt-24 lg:px-8">
        <DeferredGLSLHills
          className="z-0 [mask-image:linear-gradient(to_bottom,black_0%,black_58%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_58%,transparent_100%)]"
          cameraZ={125}
          speed={0.7}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-44 bg-gradient-to-b from-transparent via-background/70 to-background sm:h-56"
        />
        <div className="relative z-10 mx-auto w-full max-w-3xl text-center">
          <div className="defi-badge animate-fade-up inline-flex items-center gap-2 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-signal" />
            <span className="font-label text-[11px] text-muted-foreground">{t("badge")}</span>
          </div>

          <h1
            className="animate-fade-up mb-16 mt-10 bg-gradient-to-br from-foreground via-primary/80 to-primary bg-clip-text font-heading text-[clamp(2.5rem,6.5vw,3.75rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-transparent"
            style={{ animationDelay: "80ms" }}
          >
            {t("headline")}
          </h1>

          <div className="animate-fade-up mt-10" style={{ animationDelay: "200ms" }}>
            <Suspense
              fallback={
                <div className="mx-auto h-40 w-full max-w-3xl animate-pulse rounded-2xl border border-border bg-card" />
              }
            >
              <HeroPrompt />
            </Suspense>
          </div>
        </div>
      </section>

      <section className="relative -mt-10 px-6 pb-28 pt-2 sm:-mt-14 lg:px-8">
        <div className="container mx-auto">
          <HomeCommunitySectionHeader />
          <HomeCommunityPreview />
        </div>
      </section>

      <section className="relative border-t border-border/60 px-6 py-24 lg:px-8">
        <div className="container mx-auto">
          <div className="mb-16 text-center">
            <p className="mb-3 text-[12px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              // {t("howItWorks")}
            </p>
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-semibold tracking-[-0.03em]">
              {t("storyTitle")}
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
              {t("storySubtitle")}
            </p>
          </div>

          <div className="grid gap-14 lg:grid-cols-2 lg:items-center lg:gap-20">
            <ol className="space-y-2">
              {storySteps.map(({ icon: Icon, title, body }, i) => (
                <li
                  key={title}
                  className="group flex gap-4 rounded-2xl border border-transparent p-5 transition-colors hover:border-border hover:bg-muted/30"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 text-foreground/80 transition-colors group-hover:border-border">
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                      Step {i + 1}
                    </p>
                    <h3 className="mt-1.5 text-[16px] font-semibold tracking-[-0.02em]">{title}</h3>
                    <p className="mt-2 max-w-md text-[14px] leading-relaxed text-muted-foreground">
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="relative mx-auto w-full max-w-xl lg:mx-0">
              <HeroVisual />
            </div>
          </div>

          <PipelineDisclosure />
        </div>
      </section>
    </main>
  );
}
