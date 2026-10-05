import {
  automaticEntryIntervals,
  resolveEntryPolicy,
  type Source,
  type TradeContext,
  type TradeSetup,
  type TradeSetupAttempt,
  toolSchemas,
} from "@marketpilot/ai";

type SetupRequest = ReturnType<typeof toolSchemas.getTradeSetup.parse>;
type SetupEvaluation = {
  plan: TradeSetup | null;
  reason: string | null;
  sources: Source[];
  assessment?: "unavailable";
};
const higher = { "1m": "15m", "5m": "1h", "15m": "1h", "1h": "6h", "6h": "1d", "1d": "1d" } as const;

export function tradeSetupCandidates(request: SetupRequest, preferences: TradeContext): SetupRequest[] {
  const policy = resolveEntryPolicy(preferences);
  const intervals =
    policy.timeframeMode === "manual"
      ? [preferences.interval]
      : [...new Set([request.interval, ...automaticEntryIntervals(preferences.holding)])];
  const preferredScenario = request.scenario ?? "breakout";
  const scenarios =
    policy.scenario === "auto"
      ? ([preferredScenario, preferredScenario === "breakout" ? "pullback" : "breakout"] as const)
      : [policy.scenario];
  return intervals.flatMap((interval) =>
    scenarios.flatMap((scenario) => {
      const supported =
        scenario === "breakout"
          ? (["candle_close", "break_retest"] as const)
          : (["candle_close", "break_retest", "touch"] as const);
      if (
        policy.scenario === "auto" &&
        policy.condition !== "auto" &&
        !supported.some((value) => value === policy.condition)
      )
        return [];
      const conditions =
        policy.condition === "auto"
          ? [
              ...new Set([
                ...(request.condition && supported.some((value) => value === request.condition)
                  ? [request.condition]
                  : []),
                ...supported,
              ]),
            ]
          : [policy.condition];
      return conditions.map((condition) => ({
        ...request,
        interval,
        scenario,
        condition,
        trendInterval:
          policy.timeframeMode === "manual"
            ? policy.trendInterval
            : interval === request.interval
              ? (request.trendInterval ?? higher[interval])
              : higher[interval],
      }));
    }),
  );
}

export async function searchTradeSetups(
  candidates: SetupRequest[],
  preferences: TradeContext,
  evaluate: (candidate: SetupRequest) => Promise<SetupEvaluation>,
  signal: AbortSignal,
): Promise<SetupEvaluation & { attempts: TradeSetupAttempt[] }> {
  const policy = resolveEntryPolicy(preferences);
  const attempts: TradeSetupAttempt[] = [];
  let last: SetupEvaluation | undefined;
  for (const candidate of candidates) {
    signal.throwIfAborted();
    last = await evaluate(candidate);
    signal.throwIfAborted();
    attempts.push({
      interval: candidate.interval,
      trendInterval: candidate.trendInterval ?? higher[candidate.interval],
      scenario: policy.scenario === "auto" ? (candidate.scenario ?? "breakout") : policy.scenario,
      condition: policy.condition === "auto" ? (candidate.condition ?? "candle_close") : policy.condition,
      outcome: last.plan
        ? "ready"
        : last.assessment !== "unavailable" && last.sources.some((source) => source.status !== "unavailable")
          ? "no_setup"
          : "unavailable",
      reason: last.reason,
    });
    if (last.plan) return { ...last, attempts };
  }
  if (!last) throw new Error("Trade setup search requires a candidate.");
  const reason =
    policy.timeframeMode === "auto"
      ? `${attempts.every((attempt) => attempt.outcome === "unavailable") ? "Setup assessment unavailable" : attempts.some((attempt) => attempt.outcome === "unavailable") ? "No validated setup; some checks unavailable" : "No valid setup"} across ${[...new Set(attempts.map((attempt) => attempt.interval))].join(", ")}. Last reason: ${last.reason}`
      : last.reason;
  return { ...last, reason: reason?.slice(0, 160) ?? null, attempts };
}
