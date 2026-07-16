import type { ProductTourStep } from "@/components/onboarding";

export type StudioTourCopy = {
  welcomeEyebrow: string;
  welcomeTitle: string;
  welcomeBody: string;
  conversationEyebrow: string;
  conversationTitle: string;
  conversationBody: string;
  modifyEyebrow: string;
  modifyTitle: string;
  modifyBody: string;
  panelsEyebrow: string;
  panelsTitle: string;
  panelsBody: string;
  previewEyebrow: string;
  previewTitle: string;
  previewBody: string;
  designEyebrow: string;
  designTitle: string;
  designBody: string;
  finishEyebrow: string;
  finishTitle: string;
  finishBody: string;
};

/**
 * Studio first-run tour. Targets: `[data-ox-tour="<id>"]`.
 * `panel` hints the host to switch Topology / Code / Preview when the step shows.
 */
export function buildStudioOnboardingSteps(copy: StudioTourCopy): ProductTourStep[] {
  return [
    {
      id: "welcome",
      target: null,
      placement: "center",
      eyebrow: copy.welcomeEyebrow,
      title: copy.welcomeTitle,
      description: copy.welcomeBody,
      media: {
        src: "/onboarding/studio-tour-welcome.png",
        alt: "Studio：对话、预览与构建工作台",
      },
    },
    {
      id: "conversation",
      target: "studio-conversation",
      placement: "right",
      eyebrow: copy.conversationEyebrow,
      title: copy.conversationTitle,
      description: copy.conversationBody,
      spotlightPadding: 8,
      spotlightAlign: "start",
      // flex-1 scroll rail is huge — show an upper band, stop above Modify.
      spotlightContentSelector: ":scope > *",
      spotlightContentAxis: "vertical",
      spotlightMaxHeightRatio: 0.42,
      spotlightMaxHeightPx: 420,
      spotlightClampAbove: "studio-modify",
    },
    {
      id: "modify",
      target: "studio-modify",
      placement: "right",
      eyebrow: copy.modifyEyebrow,
      title: copy.modifyTitle,
      description: copy.modifyBody,
      spotlightPadding: 10,
    },
    {
      id: "panels",
      target: "studio-panels",
      placement: "bottom",
      eyebrow: copy.panelsEyebrow,
      title: copy.panelsTitle,
      description: copy.panelsBody,
      spotlightPadding: 10,
      panel: "topology",
    },
    {
      id: "preview",
      target: "studio-preview",
      placement: "left",
      eyebrow: copy.previewEyebrow,
      title: copy.previewTitle,
      description: copy.previewBody,
      spotlightPadding: 12,
      panel: "preview",
    },
    {
      id: "design-pick",
      target: "studio-design-pick",
      placement: "bottom",
      eyebrow: copy.designEyebrow,
      title: copy.designTitle,
      description: copy.designBody,
      spotlightPadding: 10,
      panel: "preview",
    },
    {
      id: "finish",
      target: null,
      placement: "center",
      eyebrow: copy.finishEyebrow,
      title: copy.finishTitle,
      description: copy.finishBody,
      panel: "preview",
    },
  ];
}
