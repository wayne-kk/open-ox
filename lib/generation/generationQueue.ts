import { Queue } from "bullmq";
import IORedis from "ioredis";

export const GENERATION_QUEUE_NAME = "open-ox-generation";

type QueueHolder = {
  queue?: Queue<GenerationQueuePayload>;
  connection?: IORedis;
};

type GenerationQueuePayload = {
  runId: string;
};

const globalQueue = globalThis as typeof globalThis & {
  __openOxGenerationQueue?: QueueHolder;
};

export function generationRedisUrl(): string {
  return process.env.REDIS_URL?.trim() || "redis://127.0.0.1:6379";
}

export function createGenerationRedisConnection(options?: {
  worker?: boolean;
}): IORedis {
  return new IORedis(generationRedisUrl(), {
    maxRetriesPerRequest: options?.worker ? null : 2,
    enableReadyCheck: true,
    connectTimeout: 5_000,
  });
}

export function getGenerationQueue(): Queue<GenerationQueuePayload> {
  const holder = (globalQueue.__openOxGenerationQueue ??= {});
  if (!holder.connection) {
    holder.connection = createGenerationRedisConnection();
  }
  if (!holder.queue) {
    holder.queue = new Queue<GenerationQueuePayload>(GENERATION_QUEUE_NAME, {
      connection: holder.connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 1_000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    });
  }
  return holder.queue;
}

/** The database row is durable; Redis only carries an idempotent wake-up signal. */
export async function notifyGenerationRunQueued(runId: string): Promise<void> {
  await getGenerationQueue().add("execute", { runId }, { jobId: runId });
}
