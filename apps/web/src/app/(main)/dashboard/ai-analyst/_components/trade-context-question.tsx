"use client";
import { useEffect, useRef, useState } from "react";

import {
  defaultTradePreferences,
  resolveEntryPolicy,
  type TradeContext,
  type JournalRecord,
  type TradePreferences,
  TradePreferencesSchema,
} from "@marketpilot/ai/contracts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest } from "@/lib/api/client";

import { MarketSymbolField } from "../../_components/market-symbol-field";
import { TradePreferenceFields } from "../../journal/_components/trade-preference-fields";
export function TradeContextQuestion({
  symbol,
  initialContext,
  revisionId,
  onConfirm,
  onCancel,
}: {
  symbol: string;
  initialContext?: TradeContext;
  revisionId?: string;
  onConfirm: (context: TradeContext) => void;
  onCancel: () => void;
}) {
  const [selectedSymbol, setSelectedSymbol] = useState(symbol);
  const memory = useApiResource<{ saved: boolean; preferences: TradePreferences }>("/journal/preferences/state");
  const revision = useApiResource<JournalRecord>(revisionId ? `/journal/${revisionId}` : null);
  const [initialized, setInitialized] = useState(false);
  const [value, setValue] = useState(defaultTradePreferences);
  const [confirming, setConfirming] = useState(false);
  const heading = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (confirming) heading.current?.focus();
  }, [confirming]);
  const [remember, setRemember] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (memory.data && !initialized && (!revisionId || revision.data)) {
      const source = initialContext ?? revision.data?.context ?? memory.data.preferences;
      setValue({
        capital: source.capital,
        currency: source.currency,
        riskPercent: source.riskPercent,
        interval: source.interval,
        holding: source.holding,
        autoReview: source.autoReview,
        entryPolicy: source.entryPolicy,
      });
      setSelectedSymbol(initialContext?.symbol ?? revision.data?.symbol ?? symbol);
      setConfirming(!initialContext && memory.data.saved);
      setInitialized(true);
    }
  }, [memory.data, initialized, revisionId, revision.data, initialContext, symbol]);
  const valid =
    TradePreferencesSchema.safeParse(value).success && resolveEntryPolicy(value).roundTripCostPercent != null;
  async function confirm() {
    if (
      !valid ||
      pending ||
      !initialized ||
      memory.loading ||
      memory.error ||
      revision.error ||
      (revisionId &&
        (revision.loading || !revision.data?.planVersion || !["planned", "expired"].includes(revision.data.status)))
    )
      return;
    setPending(true);
    setError(null);
    try {
      if (remember) await apiRequest("/journal/preferences", { method: "PATCH", body: JSON.stringify(value) });
      onConfirm({
        ...value,
        symbol: selectedSymbol,
        ...(revision.data ? { revisesEntryId: revision.data.id, revisesPlanVersion: revision.data.planVersion } : {}),
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Preferences could not be saved.");
    } finally {
      setPending(false);
    }
  }
  return (
    <Card size="sm" className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle ref={heading} tabIndex={-1} className="outline-none">
          {!initialized
            ? "Trading context"
            : confirming
              ? "Confirm your trading context"
              : `Before we analyse ${selectedSymbol}`}
        </CardTitle>
        <CardDescription>
          {!initialized
            ? "Loading your trading memory…"
            : confirming
              ? "Review these details. Analysis starts only after your confirmation."
              : "Confirm the market, timeframe and risk limit. Saved preferences are filled in for you."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!initialized ? (
          memory.loading ? (
            <Skeleton className="h-24 w-full" />
          ) : null
        ) : confirming ? (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Market", selectedSymbol],
              [
                "Entry / trend",
                resolveEntryPolicy(value).timeframeMode === "auto"
                  ? "Auto · bounded proposal"
                  : `${value.interval} / ${resolveEntryPolicy(value).trendInterval}`,
              ],
              [
                "Entry validity",
                resolveEntryPolicy(value).validityMode === "auto"
                  ? "Auto · 1–12 candles, max 72h"
                  : `${resolveEntryPolicy(value).validityCandles} entry candles · max 72h`,
              ],
              [
                "Scenario / condition",
                `${resolveEntryPolicy(value).scenario} / ${resolveEntryPolicy(value).condition}`,
              ],
              [
                "Holding style",
                {
                  scalp: "Scalp · minutes",
                  day: "Intraday · hours",
                  swing: "Swing · several days",
                  hybrid: "Hybrid · flexible duration",
                }[value.holding],
              ],
              ["Risk limit", `${value.riskPercent}%`],
              [
                "Estimated round-trip costs",
                resolveEntryPolicy(value).roundTripCostPercent == null
                  ? "Required · edit preferences"
                  : `${resolveEntryPolicy(value).roundTripCostPercent}%`,
              ],
              ["Minimum net reward / risk", `${resolveEntryPolicy(value).minimumNetRewardRisk ?? 1.5}R`],
              [
                "Manual capital",
                value.capital ? `${value.capital.toLocaleString()} ${value.currency}` : "Not supplied · no sizing",
              ],
              ["AI event comments", value.autoReview ? "Enabled · uses research allowance" : "Off"],
            ].map(([label, text]) => (
              <div key={label}>
                <dt className="text-muted-foreground text-xs">{label}</dt>
                <dd className="mt-1 font-medium">{text}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <>
            <Field>
              <FieldLabel htmlFor="trade-context-market">Market for this plan</FieldLabel>
              <MarketSymbolField
                id="trade-context-market"
                value={selectedSymbol}
                onChange={setSelectedSymbol}
                disabled={pending || !!revisionId}
              />
            </Field>
            <TradePreferenceFields value={value} onChange={setValue} disabled={pending || memory.loading} />
          </>
        )}
        {initialized && !confirming ? (
          <Field orientation="horizontal">
            <Checkbox
              id="remember-trade-context"
              checked={remember}
              onCheckedChange={(checked) => setRemember(checked === true)}
              disabled={pending}
            />
            <FieldLabel htmlFor="remember-trade-context">Remember these preferences in Journal</FieldLabel>
          </Field>
        ) : null}
        {revisionId && revision.data && !["planned", "expired"].includes(revision.data.status) ? (
          <p role="alert" className="text-destructive text-xs">
            This plan has an execution or is cancelled. Manage its recorded trade separately.
          </p>
        ) : null}
        {revisionId ? (
          <p className="text-muted-foreground text-xs">
            A replacement is proposed only. The previous plan stays unchanged until you confirm and save the new
            proposal. Open trades cannot be replaced.
          </p>
        ) : null}
        {memory.error || revision.error || error ? (
          <p role="alert" className="text-destructive text-sm">
            {error ?? revision.error ?? memory.error}
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={
            !valid ||
            pending ||
            !initialized ||
            memory.loading ||
            !!memory.error ||
            !!revision.error ||
            (!!revisionId &&
              (revision.loading ||
                !revision.data?.planVersion ||
                !["planned", "expired"].includes(revision.data.status)))
          }
          onClick={() => (confirming ? void confirm() : setConfirming(true))}
        >
          {pending ? "Saving…" : confirming ? "Confirm & analyse" : "Review details"}
        </Button>
        {memory.error ? (
          <Button size="sm" variant="outline" onClick={memory.reload}>
            Retry
          </Button>
        ) : null}
        {initialized && confirming ? (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setConfirming(false)}>
            Edit
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );
}
