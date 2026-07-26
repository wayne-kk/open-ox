export const PROJECT_CREATION_MAINTENANCE_PATH = "/maintenance";

export const PROJECT_CREATION_MAINTENANCE_RESPONSE = {
  error: "Project creation is temporarily unavailable while the service is under maintenance.",
  code: "PROJECT_CREATION_MAINTENANCE",
} as const;

export async function getProjectCreationMaintenanceStatus(): Promise<boolean> {
  try {
    const response = await fetch("/api/project-creation-status", { cache: "no-store" });
    if (!response.ok) return true;
    const data = (await response.json()) as { maintenance?: unknown };
    return data.maintenance !== false;
  } catch {
    return true;
  }
}
