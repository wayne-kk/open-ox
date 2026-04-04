// Import shared types from the AI flow layer
import type { StepLlmCall, StepTrace, BuildStep } from "@/ai/flows/generate_project/types";
// Re-export for consumers
export type { StepLlmCall, StepTrace, BuildStep };

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
        layoutSections: Array<{
            fileName: string;
            type: string;
        }>;
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

export interface AiResponse {
    content: string;
    projectId?: string;
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
