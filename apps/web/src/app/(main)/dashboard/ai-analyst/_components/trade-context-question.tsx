"use client";
import { useEffect, useRef, useState } from "react";

import {
  defaultTradePreferences,
  type TradeContext,
  type TradePreferences,
  TradePreferencesSchema,
} from "@marketpilot/ai/contracts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest } from "@/lib/api/client";

import { MarketSymbolField } from "../../_components/market-symbol-field";
import { TradePreferenceFields } from "../../journal/_components/trade-preference-fields";
export function TradeContextQuestion({
  symbol,
  onConfirm,
  onCancel,
}: {
  symbol: string;
  onConfirm: (context: TradeContext) => void;
  onCancel: () => void;
}) {
  const [selectedSymbol, setSelectedSymbol] = useState(symbol);
  const memory = useApiResource<TradePreferences>("/journal/preferences");
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
    if (memory.data) setValue(memory.data);
  }, [memory.data]);
  const valid = TradePreferencesSchema.safeParse(value).success;
  async function confirm() {
    if (!valid || pending) return;
    setPending(true);
    setError(null);
    try {
      if (remember) await apiRequest("/journal/preferences", { method: "PATCH", body: JSON.stringify(value) });
      onConfirm({ ...value, symbol: selectedSymbol });
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
          {confirming ? "Confirm your trading context" : `Before we analyse ${selectedSymbol}`}
        </CardTitle>
        <CardDescription>
          {confirming
            ? "Review these details. Analysis starts only after your confirmation."
            : "Confirm the market, timeframe and risk limit. Saved preferences are filled in for you."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {confirming ? (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Market", selectedSymbol],
              ["Timeframe", value.interval],
              ["Holding period", value.holding],
              ["Risk limit", `${value.riskPercent}%`],
              [
                "Capital",
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
                disabled={pending}
              />
            </Field>
            <TradePreferenceFields value={value} onChange={setValue} disabled={pending || memory.loading} />
          </>
        )}
        <Field orientation="horizontal">
          <Checkbox
            id="remember-trade-context"
            checked={remember}
            onCheckedChange={(checked) => setRemember(checked === true)}
            disabled={pending}
          />
          <FieldLabel htmlFor="remember-trade-context">Remember these preferences in Journal</FieldLabel>
        </Field>
        {memory.error || error ? (
          <p role="alert" className="text-destructive text-sm">
            {error ?? memory.error}
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={!valid || pending || memory.loading}
          onClick={() => (confirming ? void confirm() : setConfirming(true))}
        >
          {pending ? "Saving…" : confirming ? "Confirm & analyse" : "Review details"}
        </Button>
        {confirming ? (
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
