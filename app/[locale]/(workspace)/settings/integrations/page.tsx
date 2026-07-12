import { Suspense } from "react";
import { IntegrationsSettingsClient } from "@/app/components/IntegrationsSettingsClient";

export default function IntegrationsSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 py-10 text-[13px] text-muted-foreground">
          加载中…
        </div>
      }
    >
      <IntegrationsSettingsClient />
    </Suspense>
  );
}
