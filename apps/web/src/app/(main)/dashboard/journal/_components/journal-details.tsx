"use client";
import { useEffect, useRef, useState } from "react";

import Link from "next/link";

import type { JournalRecord } from "@marketpilot/ai/contracts";
import type { MarketObservation } from "@marketpilot/market-data";
import { ChartCandlestick, Ellipsis, Sparkles, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ConditionalEntrySummary } from "../../_components/conditional-entry-summary";
import { TradeSizeField, useTradeSize } from "./trade-size-field";
import { JournalDatePicker } from "./journal-date-picker";
import { localDate } from "./journal-dates";
import { JournalExecutionEditor } from "./journal-execution-editor";
import { JournalNotes } from "./journal-notes";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest } from "@/lib/api/client";

import { chartPrice } from "../../_components/market-chart-utils";
import { MarketHistoryPanel } from "../../_components/market-history-panel";
import { ResourceState } from "../../_components/resource-state";
export function journalProfit(entry: JournalRecord) {
  if (entry.entryPrice === null || entry.quantity === null || entry.quantity <= 0) return null;
  const entryPrice = entry.entryPrice;
  const exits = entry.exits ?? [];
  const sign = entry.plan.direction === "BUY" ? 1 : -1;
  if (exits.length) {
    const exited = exits.reduce((sum, exit) => sum + exit.quantity, 0);
    return exits.reduce(
      (sum, exit) => sum + (exit.price - entryPrice) * exit.quantity * sign - exit.fees,
      (-entry.fees * exited) / entry.quantity,
    );
  }
  return entry.status === "closed" && entry.exitPrice !== null
    ? (entry.exitPrice - entry.entryPrice) * entry.quantity * sign - entry.fees
    : null;
}
export function JournalDetails({ id, close, changed }: { id: string; close: () => void; changed?: () => void }) {
  const resource = useApiResource<JournalRecord>(`/journal/${id}`, { keepDataOnReload: true });
  const entry = resource.data;
  const market = useApiResource<{ data: MarketObservation; freshness: string }>(
    entry ? `/market-data/${encodeURIComponent(entry.symbol)}?interval=${entry.plan.interval}` : null,
    { keepDataOnReload: true },
  );
  const [notes, setNotes] = useState("");
  const [correcting, setCorrecting] = useState(false);
  const [action, setAction] = useState<"open" | "closed" | "cancelled" | null>(null);
  const [price, setPrice] = useState("");
  const executionInstant = useRef(new Date());
  const [executionTime, setExecutionTime] = useState(() => localDate(executionInstant.current));
  const tradeSize = useTradeSize(price);
  const quantity = tradeSize.quantity;
  const [fees, setFees] = useState("0");
  const [pending, setPending] = useState(false);
  const exitRequest = useRef(crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const savedNotes = entry?.notes;

  useEffect(() => {
    if (savedNotes !== undefined) setNotes(savedNotes);
  }, [savedNotes]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !action && !pending) {
        resource.reload();
        market.reload();
      }
    }, 65_000);
    return () => clearInterval(timer);
  }, [resource.reload, market.reload, action, pending]);
  function updated() {
    resource.reload();
    changed?.();
    window.dispatchEvent(new Event("marketpilot:journal-changed"));
  }
  function beginAction(next: "open" | "closed" | "cancelled") {
    executionInstant.current = new Date();
    setExecutionTime(localDate(executionInstant.current));
    setFees("0");
    setPrice(next === "open" && entry ? String(entry.plan.entry) : "");
    setAction(next);
  }
  function executionDate() {
    return executionTime === localDate(executionInstant.current)
      ? executionInstant.current.toISOString()
      : new Date(executionTime).toISOString();
  }
  async function save() {
    if (!entry || pending) return;
    setPending(true);
    setError(null);
    try {
      await apiRequest(action === "closed" ? `/journal/${id}/exits` : `/journal/${id}`, {
        method: action === "closed" ? "POST" : "PATCH",
        body: JSON.stringify(
          action === "closed"
            ? {
                requestId: exitRequest.current,
                price: Number(price),
                quantity:
                  (entry.quantity ?? (entry.source === "ai" && entry.resultBasis === "estimated" ? 1 : 0)) -
                  (entry.exits ?? []).reduce((sum, exit) => sum + exit.quantity, 0),
                fees: Number(fees),
                occurredAt: executionDate(),
                reason: "manual",
              }
            : {
                notes,
                ...(action ? { status: action } : {}),
                ...(action === "open"
                  ? {
                      entryPrice: Number(price),
                      quantity: Number(quantity),
                      fees: Number(fees),
                      openedAt: executionDate(),
                    }
                  : {}),
              },
        ),
      });
      setAction(null);
      exitRequest.current = crypto.randomUUID();
      updated();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Journal could not be updated.");
    } finally {
      setPending(false);
    }
  }
  async function review(eventId: string) {
    setPending(true);
    setError(null);
    try {
      await apiRequest(`/journal/${id}/review/${eventId}`, { method: "POST" });
      updated();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "AI review unavailable.");
    } finally {
      setPending(false);
    }
  }
  const validAction =
    !action ||
    action === "cancelled" ||
    (Number(price) > 0 && Number(fees) >= 0 && (action !== "open" || Number(quantity) > 0));
  const risk = entry?.context.capital ? (entry.context.capital * entry.context.riskPercent) / 100 : null;
  const size =
    entry && risk !== null && entry.context.currency === entry.plan.quote
      ? (entry.plan.conditionalEntry?.sizing.baseUnits ??
        Math.min(risk / Math.abs(entry.plan.entry - entry.plan.stopLoss), entry.context.capital! / entry.plan.entry))
      : null;
  const profit = entry ? journalProfit(entry) : null;
  const simulation = entry?.trackingMode === "automatic" || entry?.resultBasis === "estimated";
  const referenceReturn =
    entry?.source === "ai" && entry.quantity === null && entry.entryPrice && entry.exits?.length
      ? (entry.exits.reduce(
          (sum, exit) =>
            sum +
            (exit.price - entry.entryPrice!) * exit.quantity * (entry.plan.direction === "BUY" ? 1 : -1) -
            exit.fees,
          0,
        ) /
          entry.entryPrice) *
        100
      : null;
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !pending) close();
      }}
    >
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>
            {entry ? `${entry.symbol} · ${entry.plan.direction === "BUY" ? "Long" : "Short"}` : "Journal details"}
          </SheetTitle>
          <SheetDescription>
            {entry ? `${entry.plan.interval} · ${entry.status}` : "Your trade and execution history."}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 pb-6">
          <ResourceState
            loading={resource.loading}
            error={resource.error}
            title="Journal details unavailable"
            retry={resource.reload}
          />
          {entry ? (
            <>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  ["Entry", entry.plan.entry],
                  ["Stop loss", entry.plan.stopLoss],
                  ...entry.plan.targets.map((target, i) => [`TP ${i + 1}`, target]),
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-muted-foreground text-xs">{label}</dt>
                    <dd className="mt-1 font-medium text-sm tabular-nums">
                      {chartPrice(Number(value))} {entry.plan.quote}
                    </dd>
                  </div>
                ))}
              </dl>
              <ConditionalEntrySummary plan={entry.plan} />
              {entry.source === "ai" && !entry.plan.conditionalEntry ? (
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <span>
                    Risk limit <strong>{entry.context.riskPercent}%</strong>
                    {risk !== null ? ` · ${chartPrice(risk)} ${entry.context.currency}` : " · capital not supplied"}
                  </span>
                  {size !== null && !entry.plan.conditionalEntry ? (
                    <span>
                      Indicative size <strong>{size.toLocaleString(undefined, { maximumFractionDigits: 6 })}</strong>{" "}
                      {entry.symbol.split("-")[0]}
                    </span>
                  ) : risk !== null ? (
                    <span className="text-muted-foreground">
                      Sizing unavailable: account and quote currencies differ.
                    </span>
                  ) : null}
                </div>
              ) : null}
              {size !== null ? (
                <p className="text-muted-foreground text-xs">
                  Unleveraged size is capped by supplied capital. New AI plans include your estimated round-trip costs;
                  actual costs may differ.
                </p>
              ) : null}
              {market.data ? (
                <MarketHistoryPanel
                  data={market.data.data}
                  stale={market.data.freshness === "stale"}
                  compact
                  className="shrink-0"
                  journal={[entry]}
                  journalPreview
                  status={
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/markets/${encodeURIComponent(entry.symbol)}`}>
                        <ChartCandlestick /> Market chart
                      </Link>
                    </Button>
                  }
                />
              ) : (
                <ResourceState
                  loading={market.loading}
                  error={market.error}
                  title="Chart unavailable"
                  retry={market.reload}
                />
              )}
              <details>
                <summary className="cursor-pointer font-medium text-sm">Original analysis & context</summary>
                <div className="mt-3 flex flex-col gap-2 text-muted-foreground text-sm">
                  {!entry.analysis.length ? <p>Original AI analysis is unavailable for this market.</p> : null}
                  {entry.analysis.map((item, i) => (
                    <p key={i}>{item.text}</p>
                  ))}
                  <p>
                    Created {new Date(entry.createdAt).toLocaleString()} · Plan validity{" "}
                    {new Date(entry.plan.expiresAt).toLocaleString()}
                  </p>
                  <p>{entry.plan.targetBasis ?? "Original saved target method"}</p>
                </div>
              </details>
              <Separator />
              <section className="flex flex-col gap-3" aria-label="Trade simulation">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h2 className="font-medium text-sm">{simulation ? "Simulation" : "Trade record"}</h2>
                    <Badge variant="outline">
                      {entry.status === "planned"
                        ? "Awaiting entry"
                        : entry.status === "open"
                          ? "Position open"
                          : entry.status === "closed"
                            ? "Position closed"
                            : entry.status === "expired"
                              ? "Plan expired"
                              : "Plan cancelled"}
                    </Badge>
                  </div>
                  {!action && (entry.status === "planned" || entry.status === "open" || entry.status === "expired") ? (
                    <div className="flex items-center gap-1">
                      {entry.status === "open" && entry.quantity === null ? (
                        <Button variant="outline" size="sm" onClick={() => setCorrecting(true)}>
                          Set position amount
                        </Button>
                      ) : null}
                      {!(entry.trackingMode === "automatic" && entry.status !== "open") ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          onClick={() => {
                            beginAction(entry.status === "open" ? "closed" : "open");
                          }}
                        >
                          {entry.status === "open"
                            ? "Close position"
                            : entry.status === "expired"
                              ? "Record earlier execution"
                              : "Record entry"}
                        </Button>
                      ) : null}
                      {entry.status === "planned" ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" disabled={pending} aria-label="Plan actions">
                              <Ellipsis />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem variant="destructive" onSelect={() => beginAction("cancelled")}>
                              <X /> Cancel plan
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {entry.openedAt ? (
                  <p className="text-sm">
                    Entry {chartPrice(entry.entryPrice!)} ·{" "}
                    {entry.quantity === null
                      ? "Percentage simulation · capital not supplied"
                      : `Quantity ${entry.quantity}`}{" "}
                    · {new Date(entry.openedAt).toLocaleString()}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    {entry.status === "planned"
                      ? entry.trackingMode === "automatic"
                        ? "Entry opens automatically when the saved condition is met; SL and TP then close the simulated position."
                        : "Waiting for your entry. Record the fill price and quantity after you trade."
                      : "This plan ended without a recorded entry."}
                  </p>
                )}
                {profit !== null ? (
                  <p className="font-semibold tabular-nums">
                    {entry.resultBasis === "estimated" ? "Simulated result" : "Recorded result"}{" "}
                    {profit >= 0 ? "+" : ""}
                    {chartPrice(profit)} {entry.plan.quote}
                    <span className="ml-2 font-normal text-muted-foreground text-xs">
                      {entry.resultBasis === "estimated" ? "Candle-based simulation" : "After recorded fees"}
                    </span>
                  </p>
                ) : null}
                {referenceReturn !== null ? (
                  <p className="font-semibold tabular-nums">
                    Realised return {referenceReturn >= 0 ? "+" : ""}
                    {referenceReturn.toFixed(2)}%
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      No monetary P&amp;L without a position amount
                    </span>
                  </p>
                ) : null}
                {action ? (
                  <FieldGroup className="grid gap-3 sm:grid-cols-2">
                    {action !== "cancelled" ? (
                      <>
                        <Field>
                          <FieldLabel htmlFor="execution-price">
                            {simulation ? "Simulation" : "Recorded"} {action === "open" ? "entry" : "exit"} price ·{" "}
                            {entry.plan.quote}
                          </FieldLabel>
                          <Input
                            id="execution-price"
                            type="number"
                            step="any"
                            min="0.00000001"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            disabled={pending}
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="execution-time">
                            {simulation ? "Simulation" : "Recorded"} {action === "open" ? "entry" : "exit"} time
                          </FieldLabel>
                          <JournalDatePicker
                            id="execution-time"
                            value={executionTime}
                            onChange={setExecutionTime}
                            disabled={pending}
                          />
                        </Field>
                        {action === "open" ? (
                          <>
                            <TradeSizeField
                              id="execution-quantity"
                              symbol={entry.symbol}
                              price={price}
                              size={tradeSize}
                              disabled={pending}
                            />
                          </>
                        ) : null}
                        <Field>
                          <FieldLabel htmlFor="execution-fees">
                            {action === "closed" ? "Exit fees" : "Entry fees"} · {entry.plan.quote}
                          </FieldLabel>
                          <Input
                            id="execution-fees"
                            type="number"
                            step="any"
                            min="0"
                            value={fees}
                            onChange={(e) => setFees(e.target.value)}
                            disabled={pending || (entry.quantity === null && entry.status === "open")}
                          />
                        </Field>
                      </>
                    ) : (
                      <p className="text-sm sm:col-span-2">Confirm cancellation of this unexecuted plan?</p>
                    )}
                    <div className="flex gap-2 sm:col-span-2">
                      <Button size="sm" disabled={pending || !validAction} onClick={() => void save()}>
                        Confirm {action === "open" ? "entry" : action === "closed" ? "exit" : "cancellation"}
                      </Button>
                      <Button size="sm" variant="ghost" disabled={pending} onClick={() => setAction(null)}>
                        Back
                      </Button>
                    </div>
                  </FieldGroup>
                ) : null}
              </section>
              <JournalNotes
                key={entry.id}
                entry={entry}
                notes={notes}
                setNotes={setNotes}
                pending={pending || !!action}
                onSave={() => void save()}
              />
              {error ? (
                <p role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              ) : null}
              <Separator />
              <section className="flex flex-col gap-4">
                <p className="text-muted-foreground text-xs">
                  {entry.resultBasis === "estimated"
                    ? "Simulation · one-minute price tracking."
                    : entry.entryPrice === null
                      ? "Price observations · no recorded execution"
                      : "Recorded executions"}{" "}
                  · {entry.source} · {entry.trackingMode} tracking
                </p>
                <h2 className="font-medium text-sm">Timeline & AI review</h2>
                <p className="text-muted-foreground text-xs">
                  {entry.monitoringStatus ?? "Monitoring begins on the next scheduled check."}
                  {entry.checkedAt ? ` · Checked through ${new Date(entry.checkedAt).toLocaleString()}` : ""}
                </p>
                {[...entry.events]
                  .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
                  .map((event) => (
                    <article key={event.id} className="flex flex-col gap-2 border-l-2 pl-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{event.kind}</Badge>
                        <time className="text-muted-foreground text-xs">
                          {new Date(event.occurredAt).toLocaleString()}
                        </time>
                      </div>
                      <p className="text-sm">{event.evidence.message}</p>
                      {event.kind === "ambiguous" && entry.events.some((item) => item.key === "simulation-repair") ? (
                        <Badge variant="secondary" className="self-start">
                          Resolved by one-minute replay
                        </Badge>
                      ) : null}
                      {event.evidence.previousEntryId || event.evidence.replacementEntryId ? (
                        <Button variant="link" size="sm" className="self-start" asChild>
                          <Link
                            href={`/dashboard/journal?entry=${event.evidence.previousEntryId ?? event.evidence.replacementEntryId}`}
                          >
                            {event.evidence.previousEntryId ? "Previous confirmed plan" : "Confirmed replacement plan"}
                          </Link>
                        </Button>
                      ) : null}
                      {event.evidence.previousPlan && event.evidence.confirmedPlan ? (
                        <details>
                          <summary className="cursor-pointer text-muted-foreground text-xs">Confirmed changes</summary>
                          <dl className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                            <div>
                              <dt>Previous SL / entry deadline</dt>
                              <dd>
                                {event.evidence.previousPlan.stopLoss} /{" "}
                                {new Date(event.evidence.previousPlan.expiresAt).toLocaleString()}
                              </dd>
                            </div>
                            <div>
                              <dt>Confirmed SL / entry deadline</dt>
                              <dd>
                                {event.evidence.confirmedPlan.stopLoss} /{" "}
                                {new Date(event.evidence.confirmedPlan.expiresAt).toLocaleString()}
                              </dd>
                            </div>
                          </dl>
                        </details>
                      ) : null}
                      {event.evidence.source ? (
                        <p className="text-muted-foreground text-xs">
                          {event.evidence.source} · {event.evidence.interval} completed candle
                        </p>
                      ) : null}
                      {event.review &&
                      entry.events.some((item) => item.key === "simulation-repair") &&
                      ["ambiguous", "entry", "retest"].includes(event.kind) ? (
                        <details>
                          <summary className="cursor-pointer text-muted-foreground text-xs">
                            Earlier AI review · before simulation correction
                          </summary>
                          <p className="mt-2 text-muted-foreground text-sm">{event.review}</p>
                        </details>
                      ) : event.review ? (
                        <p className="text-muted-foreground text-sm">
                          <Sparkles className="mr-1 inline size-3" />
                          {event.review}
                        </p>
                      ) : event.reviewStatus === "running" &&
                        event.reviewStartedAt &&
                        Date.now() - Date.parse(event.reviewStartedAt) < 120_000 ? (
                        <p role="status" className="text-muted-foreground text-xs">
                          AI review in progress…
                        </p>
                      ) : event.reviewStatus !== "not_needed" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="self-start"
                          disabled={pending}
                          onClick={() => void review(event.id)}
                        >
                          <Sparkles data-icon="inline-start" />
                          {event.reviewStatus === "unavailable" ? "Retry AI review" : "Review with AI"}
                          <span className="text-muted-foreground text-xs">· uses allowance</span>
                        </Button>
                      ) : null}
                    </article>
                  ))}
              </section>
            </>
          ) : null}
        </div>
        {correcting && entry ? (
          <JournalExecutionEditor
            entry={entry}
            close={() => setCorrecting(false)}
            changed={() => {
              resource.reload();
              changed?.();
            }}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
