import { createGenerationRedisConnection } from "@/lib/generation/generationQueue";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

async function main(): Promise<void> {
  const redis = createGenerationRedisConnection();
  redis.on("error", () => undefined);
  try {
    const pong = await redis.ping();
    if (pong !== "PONG") throw new Error(`unexpected Redis response: ${pong}`);
  } finally {
    await redis.quit().catch(() => redis.disconnect());
  }

  const admin = createSupabaseServiceRoleClient();
  const { error } = await admin.rpc("claim_generation_run_by_id", {
    p_run_id: "00000000-0000-0000-0000-000000000000",
    p_worker: "deploy-preflight",
    p_lease_seconds: 60,
  });
  if (error) {
    throw new Error(
      `Supabase migration 040_claim_generation_run_by_id.sql is not ready: ${error.message}`,
    );
  }

  console.info("Generation queue prerequisites ready: Redis PONG, claim RPC available");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
