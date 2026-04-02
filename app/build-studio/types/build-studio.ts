export interface StepLlmCall {
    model?: string;
    systemPrompt?: string;
    userMessage?: string;
    rawResponse?: string;
    inputTokens?: number;
    outputTokens?: number;
}

export interface StepTrace {
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    llmCall?: StepLlmCall;
    validationResult?: {
        passed: boolean;
        checks: Array<{ name: string; passed: boolean; detail?: string }>;
    };
}

export interface BuildStep {
    step: string;
    status: "ok" | "error" | "active";
    detail?: string;
    timestamp: number;
    duration: number;
    skillId?: string | null;
    trace?: StepTrace;
}

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
