export const workerRegistryKey = "marketpilot:alerts:instances:v1";
export const workerStatusPrefix = "marketpilot:alerts:status:v1:";
export interface QueueRuntime {
  name: string;
  ready: boolean;
  lastCompletedAt: string | null;
  lastFailedAt: string | null;
  lastFailureCode: string | null;
  lastLatencyMs: number | null;
}
export interface WorkerSnapshot {
  workerId: string;
  checkedAt: string;
  ready: boolean;
  database: boolean;
  redis: boolean;
  queues: QueueRuntime[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function timestamp(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)))
  );
}
/** Reject invalid runtime records and project only operational, non-sensitive fields. */
export function parseWorkerSnapshot(value: string): WorkerSnapshot | null {
  if (value.length > 10000) return null;
  try {
    const data: unknown = JSON.parse(value);
    if (
      !record(data) ||
      typeof data.workerId !== "string" ||
      !/^[a-f0-9-]{36}$/.test(data.workerId) ||
      typeof data.checkedAt !== "string" ||
      !timestamp(data.checkedAt) ||
      typeof data.ready !== "boolean" ||
      typeof data.database !== "boolean" ||
      typeof data.redis !== "boolean" ||
      !Array.isArray(data.queues) ||
      data.queues.length !== 4
    )
      return null;
    const queues: QueueRuntime[] = [];
    const known = new Set(["market-refresh", "alert-evaluation", "notifications", "external-notifications"]);
    for (const queue of data.queues) {
      if (
        !record(queue) ||
        typeof queue.name !== "string" ||
        !known.delete(queue.name) ||
        typeof queue.ready !== "boolean" ||
        !timestamp(queue.lastCompletedAt) ||
        !timestamp(queue.lastFailedAt) ||
        !(
          queue.lastFailureCode === null ||
          (typeof queue.lastFailureCode === "string" && /^[A-Z_]{3,80}$/.test(queue.lastFailureCode))
        ) ||
        !(
          queue.lastLatencyMs === null ||
          (typeof queue.lastLatencyMs === "number" && Number.isFinite(queue.lastLatencyMs) && queue.lastLatencyMs >= 0)
        )
      )
        return null;
      queues.push({
        name: queue.name,
        ready: queue.ready,
        lastCompletedAt: queue.lastCompletedAt,
        lastFailedAt: queue.lastFailedAt,
        lastFailureCode: queue.lastFailureCode,
        lastLatencyMs: queue.lastLatencyMs,
      });
    }
    return {
      workerId: data.workerId,
      checkedAt: data.checkedAt,
      ready: data.ready,
      database: data.database,
      redis: data.redis,
      queues,
    };
  } catch {
    return null;
  }
}
