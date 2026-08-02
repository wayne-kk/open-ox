import type { SupabaseClient } from "@supabase/supabase-js";

import { routing } from "@/i18n/routing";
import { getProject } from "@/lib/projectManager";
import { getSiteOrigin } from "./siteUrl";
import { indexableProjectUrl, projectSeoSlug } from "./publishedProject";
import { notifySearchEngines } from "./searchEngineAdapters";

type SearchDiscoveryJob = {
  id: string;
  project_id: string;
  action: "publish" | "update" | "remove";
  seo_slug: string;
  pending_engines: Array<"indexnow" | "baidu">;
  attempts: number;
};

export interface SearchDiscovery {
  enqueueProjectChange(input: {
    projectId: string;
    action: "publish" | "update" | "remove";
  }): Promise<void>;
}

export function createSearchDiscovery(db: SupabaseClient): SearchDiscovery {
  return {
    async enqueueProjectChange(input) {
      const project = await getProject(db, input.projectId);
      if (!project) throw new Error("PROJECT_NOT_FOUND");
      const version = `${Date.now()}-${crypto.randomUUID()}`;
      const { error } = await db.from("search_discovery_jobs").insert({
        project_id: input.projectId,
        action: input.action,
        seo_slug: projectSeoSlug(project.name),
        pending_engines: ["indexnow", "baidu"],
        content_version: version,
      });
      if (error) throw new Error(`[search discovery] enqueue failed: ${error.message}`);
    },
  };
}

function retryAt(attempts: number): string {
  const delaysMinutes = [1, 5, 30, 120, 720, 1440, 2880, 4320];
  const minutes = delaysMinutes[Math.min(Math.max(attempts - 1, 0), delaysMinutes.length - 1)];
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export async function processSearchDiscoveryJobs(
  db: SupabaseClient,
  options: { limit?: number } = {}
) {
  const { data, error } = await db.rpc("claim_search_discovery_jobs", {
    batch_size: options.limit ?? 20,
  });
  if (error) throw new Error(`[search discovery] claim failed: ${error.message}`);

  const jobs = (data ?? []) as SearchDiscoveryJob[];
  const summary = { examined: jobs.length, completed: 0, retried: 0, dead: 0 };
  const origin = getSiteOrigin();

  for (const job of jobs) {
    try {
      const project = await getProject(db, job.project_id);
      if (!project) {
        await db.from("search_discovery_jobs").update({
          status: "dead",
          last_error: "PROJECT_NOT_FOUND",
        }).eq("id", job.id);
        summary.dead += 1;
        continue;
      }

      const urls = routing.locales.map((locale) =>
        indexableProjectUrl({ ...project, seoSlug: job.seo_slug }, locale, origin)
      );
      const results = await notifySearchEngines(urls, {
        siteOrigin: origin,
        indexNowKey: process.env.INDEXNOW_KEY?.trim(),
        indexNowKeyLocation: process.env.INDEXNOW_KEY_LOCATION?.trim(),
        includeIndexNow: job.pending_engines.includes("indexnow"),
        baiduSite: process.env.BAIDU_SITE?.trim(),
        baiduToken: process.env.BAIDU_PUSH_TOKEN?.trim(),
        includeBaidu: job.pending_engines.includes("baidu"),
        baiduRemoval: job.action === "remove",
      });
      const dead = results.find((result) => result.status === "dead");
      const retryEngines = results
        .filter((result) => result.status === "retry")
        .map((result) => result.engine);

      if (retryEngines.length > 0 && job.attempts < 8) {
        await db.from("search_discovery_jobs").update({
          status: "pending",
          pending_engines: retryEngines,
          engine_results: results,
          next_attempt_at: retryAt(job.attempts),
          last_error: JSON.stringify(results),
        }).eq("id", job.id);
        summary.retried += 1;
      } else if (dead || retryEngines.length > 0) {
        await db.from("search_discovery_jobs").update({
          status: "dead",
          pending_engines: [],
          engine_results: results,
          last_error: JSON.stringify(results),
        }).eq("id", job.id);
        summary.dead += 1;
      } else {
        await db.from("search_discovery_jobs").update({
          status: "completed",
          pending_engines: [],
          engine_results: results,
          completed_at: new Date().toISOString(),
          last_error: null,
        }).eq("id", job.id);
        summary.completed += 1;
      }
    } catch (error) {
      await db.from("search_discovery_jobs").update({
        status: job.attempts >= 8 ? "dead" : "pending",
        next_attempt_at: retryAt(job.attempts),
        last_error: error instanceof Error ? error.message : String(error),
      }).eq("id", job.id);
      if (job.attempts >= 8) summary.dead += 1;
      else summary.retried += 1;
    }
  }

  return summary;
}
