import type { ProductTourStep } from "@/components/onboarding";

export type WorkspaceTourCopy = {
  welcomeEyebrow: string;
  welcomeTitle: string;
  welcomeBody: string;
  promptEyebrow: string;
  promptTitle: string;
  promptBody: string;
  briefsEyebrow: string;
  briefsTitle: string;
  briefsBody: string;
  navEyebrow: string;
  navTitle: string;
  navBody: string;
  publishedEyebrow: string;
  publishedTitle: string;
  publishedBody: string;
  communityEyebrow: string;
  communityTitle: string;
  communityBody: string;
  creditsEyebrow: string;
  creditsTitle: string;
  creditsBody: string;
  finishEyebrow: string;
  finishTitle: string;
  finishBody: string;
};

/** Workspace first-login tour. Targets: `[data-ox-tour="<id>"]`. */
export function buildWorkspaceOnboardingSteps(copy: WorkspaceTourCopy): ProductTourStep[] {
  return [
    {
      id: "workspace-welcome",
      target: null,
      placement: "center",
      eyebrow: copy.welcomeEyebrow,
      title: copy.welcomeTitle,
      description: copy.welcomeBody,
    },
    {
      id: "workspace-prompt",
      target: "workspace-prompt",
      placement: "bottom",
      eyebrow: copy.promptEyebrow,
      title: copy.promptTitle,
      description: copy.promptBody,
      spotlightPadding: 8,
    },
    {
      id: "workspace-briefs",
      target: "workspace-example-briefs",
      placement: "top",
      eyebrow: copy.briefsEyebrow,
      title: copy.briefsTitle,
      description: copy.briefsBody,
      spotlightPadding: 10,
    },
    {
      id: "workspace-start-build",
      target: "workspace-start-build",
      placement: "right",
      eyebrow: copy.navEyebrow,
      title: copy.navTitle,
      description: copy.navBody,
      spotlightPadding: 10,
    },
    {
      id: "workspace-published",
      target: "workspace-published",
      placement: "right",
      eyebrow: copy.publishedEyebrow,
      title: copy.publishedTitle,
      description: copy.publishedBody,
      spotlightPadding: 8,
    },
    {
      id: "workspace-community",
      target: "workspace-community",
      placement: "right",
      eyebrow: copy.communityEyebrow,
      title: copy.communityTitle,
      description: copy.communityBody,
      spotlightPadding: 8,
    },
    {
      id: "workspace-credits",
      target: "workspace-credits",
      placement: "right",
      eyebrow: copy.creditsEyebrow,
      title: copy.creditsTitle,
      description: copy.creditsBody,
      spotlightPadding: 4,
    },
    {
      id: "workspace-finish",
      target: null,
      placement: "center",
      eyebrow: copy.finishEyebrow,
      title: copy.finishTitle,
      description: copy.finishBody,
    },
  ];
}
