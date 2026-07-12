export interface BlueprintViewModel {
  brief: {
    projectTitle: string;
    projectDescription: string;
    productScope: {
      inScope: string[];
      outOfScope: string[];
    };
    capabilities: Array<{
      capabilityId: string;
      name: string;
      priority: string;
      summary?: string;
    }>;
    roles: Array<{
      roleId: string;
      roleName: string;
      priority?: string;
      summary?: string;
      goals: string[];
    }>;
    taskLoops: Array<{
      loopId: string;
      name: string;
      summary?: string;
      steps: string[];
      successState?: string;
    }>;
  };
  experience: {
    designIntent: {
      style: string;
      colorDirection: string;
      mood: string[];
      keywords: string[];
    };
  };
  site: {
    pages: Array<{
      slug: string;
      title: string;
      description?: string;
      sections: Array<{
        fileName: string;
        type: string;
        intent?: string;
        designPlan?: { rationale?: string };
      }>;
    }>;
  };
}
