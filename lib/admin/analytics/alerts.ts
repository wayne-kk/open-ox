import { fetchAdminOverview } from "@/lib/admin/analytics/queries";
import { fetchQueueHealth } from "@/lib/admin/analytics/queries";

export type AdminAlert = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  metric?: number;
  threshold?: number;
};

function readThreshold(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

export async function evaluateAdminAlerts(): Promise<{
  alerts: AdminAlert[];
  thresholds: {
    minSuccessRate: number;
    maxQueueDepth: number;
    maxAvgWaitSeconds: number;
  };
}>;
export async function evaluateAdminAlerts(dependencies: {
  fetchOverview: typeof fetchAdminOverview;
  fetchQueue: typeof fetchQueueHealth;
}): Promise<{
  alerts: AdminAlert[];
  thresholds: {
    minSuccessRate: number;
    maxQueueDepth: number;
    maxAvgWaitSeconds: number;
  };
}>;
export async function evaluateAdminAlerts(
  dependencies: {
    fetchOverview: typeof fetchAdminOverview;
    fetchQueue: typeof fetchQueueHealth;
  } = {
    fetchOverview: fetchAdminOverview,
    fetchQueue: fetchQueueHealth,
  },
): Promise<{
  alerts: AdminAlert[];
  thresholds: {
    minSuccessRate: number;
    maxQueueDepth: number;
    maxAvgWaitSeconds: number;
  };
}> {
  const minSuccessRate = readThreshold("ANALYTICS_ALERT_MIN_SUCCESS_RATE", 80);
  const maxQueueDepth = readThreshold("ANALYTICS_ALERT_MAX_QUEUE_DEPTH", 10);
  const maxAvgWaitSeconds = readThreshold(
    "ANALYTICS_ALERT_MAX_AVG_WAIT_SECONDS",
    300,
  );

  const [overview, queue] = await Promise.all([
    dependencies.fetchOverview({ excludeInternal: true }),
    dependencies.fetchQueue(),
  ]);

  const alerts: AdminAlert[] = [];
  const successRate = overview.kpis.generationSuccessRate.today;
  const queueDepth = queue.counts.queued + queue.counts.running;

  if (successRate < minSuccessRate && successRate > 0) {
    alerts.push({
      id: "low-success-rate",
      severity: "critical",
      title: "生成成功率偏低",
      message: `今日生成成功率 ${successRate}% 低于阈值 ${minSuccessRate}%`,
      metric: successRate,
      threshold: minSuccessRate,
    });
  }

  if (queueDepth > maxQueueDepth) {
    alerts.push({
      id: "queue-backlog",
      severity: "warning",
      title: "生成队列积压",
      message: `Queued + Running 共 ${queueDepth} 个，超过阈值 ${maxQueueDepth}`,
      metric: queueDepth,
      threshold: maxQueueDepth,
    });
  }

  if (
    queue.avgWaitSeconds != null &&
    queue.avgWaitSeconds > maxAvgWaitSeconds
  ) {
    alerts.push({
      id: "high-wait-time",
      severity: "warning",
      title: "排队等待过长",
      message: `平均等待 ${queue.avgWaitSeconds}s，超过阈值 ${maxAvgWaitSeconds}s`,
      metric: queue.avgWaitSeconds,
      threshold: maxAvgWaitSeconds,
    });
  }

  if (queue.counts.failed24h > 0) {
    alerts.push({
      id: "recent-failures",
      severity: "info",
      title: "24h 内有失败 Run",
      message: `最近 24 小时失败 ${queue.counts.failed24h} 次，请查看队列页`,
      metric: queue.counts.failed24h,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "all-clear",
      severity: "info",
      title: "系统正常",
      message: "当前指标均在阈值范围内",
    });
  }

  return {
    alerts,
    thresholds: { minSuccessRate, maxQueueDepth, maxAvgWaitSeconds },
  };
}
