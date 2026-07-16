import type { ProductTourStep } from "@/components/onboarding";

export type StudioTourCopy = {
  welcomeEyebrow: string;
  welcomeTitle: string;
  welcomeBody: string;
  conversationEyebrow: string;
  conversationTitle: string;
  conversationBody: string;
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
 * Drop images later via `media: { src, alt }` on any step.
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
    },
    {
      id: "conversation",
      target: "studio-conversation",
      placement: "right",
      eyebrow: copy.conversationEyebrow,
      title: copy.conversationTitle,
      description: copy.conversationBody,
      spotlightPadding: 14,
    },
    {
      id: "panels",
      target: "studio-panels",
      placement: "bottom",
      eyebrow: copy.panelsEyebrow,
      title: copy.panelsTitle,
      description: copy.panelsBody,
      spotlightPadding: 10,
    },
    {
      id: "preview",
      target: "studio-preview",
      placement: "left",
      eyebrow: copy.previewEyebrow,
      title: copy.previewTitle,
      description: copy.previewBody,
      spotlightPadding: 12,
    },
    {
      id: "design-pick",
      target: "studio-design-pick",
      placement: "bottom",
      eyebrow: copy.designEyebrow,
      title: copy.designTitle,
      description: copy.designBody,
      spotlightPadding: 10,
    },
    {
      id: "finish",
      target: null,
      placement: "center",
      eyebrow: copy.finishEyebrow,
      title: copy.finishTitle,
      description: copy.finishBody,
    },
  ];
}
