/** Validate server configuration without ever including values in errors. */
export function validateRuntimeEnvironment() {
  const production = process.env.NODE_ENV === "production";
  if (process.env.NODE_ENV && !["development", "test", "production"].includes(process.env.NODE_ENV))
    throw new Error("Invalid configuration: NODE_ENV");
  if (process.env.NEWS_INGESTION_ENABLED && !["true", "false"].includes(process.env.NEWS_INGESTION_ENABLED))
    throw new Error("Invalid configuration: NEWS_INGESTION_ENABLED");
  for (const [name, protocols] of [
    ["DATABASE_URL", ["postgresql:", "postgres:"]],
    ["REDIS_URL", ["redis:", "rediss:"]],
  ] as const) {
    const value = process.env[name];
    if (!value && !production && name === "REDIS_URL") continue;
    try {
      const url = new URL(value ?? "");
      if (!protocols.some((protocol) => protocol === url.protocol) || !url.hostname || url.hash) throw new Error();
      if (
        production &&
        (!url.password || /^(marketpilot|password|change-me|replace-me)$/i.test(decodeURIComponent(url.password)))
      )
        throw new Error();
    } catch {
      throw new Error(`Invalid configuration: ${name}`);
    }
  }
}

/** The probe has a deadline; it does not cancel the underlying client's operation. */
export async function boundedOperation<T>(operation: Promise<T>, timeoutMs = 2500): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("OPERATION_TIMEOUT")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
