// Import shared types from the AI flow layer
import type { StepLlmCall, StepTrace, BuildStep } from "@/ai/flows/generate_project/types";
import type { IntentProgressEvent } from "@/ai/flows/generate_project/intentAgent/types";
import type { SiteOutline } from "@/lib/studio/siteOutline";
// Re-export for consumers
export type { StepLlmCall, StepTrace, BuildStep, IntentProgressEvent, SiteOutline };

export interface PlannedProjectBlueprint {
    brief: {
        projectTitle: string;
        projectDescription: string;
        productScope: {
            productType: string;
            coreOutcome: string;
            audienceSummary: string;
        };
        roles: Array<{
            roleId: string;
            roleName: string;
        }>;
        taskLoops: Array<{
            loopId: string;
            name: string;
        }>;
        capabilities: Array<{
            capabilityId: string;
            name: string;
            priority: string;
        }>;
    };
    experience: {
        designIntent: {
            mood: string[];
            style: string;
            colorDirection: string;
            keywords: string[];
        };
    };
    site: {
        informationArchitecture: {
            navigationModel: string;
            pageMap: Array<{
                slug: string;
                title: string;
                purpose: string;
                journeyStage: string;
            }>;
        };
        pages: Array<{
            slug: string;
            title: string;
            sections: Array<{
                fileName: string;
                type: string;
            }>;
        }>;
    };
}

export interface IntentAgentOption {
    id: string;
    label: string;
    hint?: string;
}

export interface IntentAgentTurn {
    status: "yield" | "implicit_yield" | "commit_generate" | "error";
    turnCounter?: number;
    mergedBrief?: string;
    errorMessage?: string;
    assistantText?: string;
    yieldPayload?: {
        kind: "capability" | "clarify" | "options" | "confirm_brief" | "confirm_direction";
        message: string;
        suggestedReplies?: string[];
        options?: IntentAgentOption[];
        briefDraftMarkdown?: string;
        siteOutline?: SiteOutline;
    };
    toolCallNames?: string[];
    inputProfile?: "sparse" | "substantive_brief" | "reference_site_focus";
    llmRoundCount?: number;
    traceSummary?: string;
    trace?: Array<
        | { kind: "llm_round"; iteration: number; toolCallNames: string[]; textPreview?: string | null }
        | { kind: "tool"; iteration: number; toolName: string; durationMs: number; argsPreview?: string }
    >;
}

export interface AiResponse {
    content: string;
    projectId?: string;
    intentAgent?: IntentAgentTurn;
    mergedBrief?: string;
    mergedBriefFromAgent?: string;
    generatedFiles?: string[];
    blueprint?: PlannedProjectBlueprint;
    verificationStatus?: "passed" | "failed";
    unvalidatedFiles?: string[];
    installedDependencies?: Array<{
        packageName: string;
        dev: boolean;
        trigger: string;
        files: string[];
    }>;
    dependencyInstallFailures?: Array<{
        packageName: string;
        dev: boolean;
        trigger: string;
        files: string[];
        error: string;
    }>;
    buildSteps?: BuildStep[];
    buildTotalDuration?: number;
    logDirectory?: string;
    error?: string;
}
