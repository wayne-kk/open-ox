"use client";

import { useTranslations } from "next-intl";
import { trackEvent } from "@/lib/analytics/client";
import {
  EXAMPLE_BRIEF_IDS,
  EXAMPLE_BRIEF_MESSAGE_KEYS,
  type ExampleBriefId,
} from "@/lib/onboarding/exampleBriefs";
import { cn } from "@/lib/utils";

export type ExampleBriefChipsProps = {
  onSelect: (prompt: string, briefId: ExampleBriefId) => void;
  className?: string;
  /** Show the soft Credits promise under the chips (logged-in Workspace empty). */
  showCreditsPromise?: boolean;
};

export function ExampleBriefChips({
  onSelect,
  className,
  showCreditsPromise = false,
}: ExampleBriefChipsProps) {
  const t = useTranslations("onboarding");

  return (
    <div className={cn("space-y-2.5", className)} data-ox-tour="workspace-example-briefs">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
        {t("exampleBriefsLabel")}
      </p>
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_BRIEF_IDS.map((id) => {
          const keys = EXAMPLE_BRIEF_MESSAGE_KEYS[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                const prompt = t(keys.prompt);
                trackEvent("onboarding_chip_click", { briefId: id });
                onSelect(prompt, id);
              }}
              className="rounded-full border border-border bg-muted/30 px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
            >
              {t(keys.label)}
            </button>
          );
        })}
      </div>
      {showCreditsPromise ? (
        <p className="max-w-xl text-[11px] leading-relaxed text-muted-foreground/85">
          {t("creditsSoftPromise")}
        </p>
      ) : null}
    </div>
  );
}
