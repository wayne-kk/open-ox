export type TimeSeriesPoint = {
  date: string;
  values: Record<string, number>;
};

export type KpiSnapshot = {
  today: number;
  yesterday: number;
  avg7d: number;
};

export type OverviewKpis = {
  newRegistrations: KpiSnapshot;
  dau: KpiSnapshot;
  newProjects: KpiSnapshot;
  firstReadyUsers: KpiSnapshot;
  generationSuccessRate: KpiSnapshot;
  avgGenerationMinutes: KpiSnapshot;
};

export type OverviewCharts = {
  userGrowth: TimeSeriesPoint[];
  projectProduction: TimeSeriesPoint[];
  generationDuration: TimeSeriesPoint[];
  activationFunnel: TimeSeriesPoint[];
};

export type OverviewResponse = {
  kpis: OverviewKpis;
  charts: OverviewCharts;
  range: { from: string; to: string; days: number };
  excludeInternal: boolean;
};

export type QueueRunRow = {
  id: string;
  projectId: string;
  userId: string | null;
  status: string;
  kind: string;
  createdAt: string;
  startedAt: string | null;
  waitSeconds: number | null;
};

export type QueueHealthResponse = {
  counts: {
    queued: number;
    running: number;
    succeeded24h: number;
    failed24h: number;
  };
  avgWaitSeconds: number | null;
  recentRuns: QueueRunRow[];
  recentErrors: Array<{
    runId: string;
    projectId: string;
    error: string;
    finishedAt: string;
  }>;
};
