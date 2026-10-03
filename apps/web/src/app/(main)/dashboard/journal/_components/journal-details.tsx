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
  const [action, setAction] = useState<"open" | "closed" | "cancelled" | null>(null);
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [fees, setFees] = useState("0");
  const [pending, setPending] = useState(false);
  const exitRequest = useRef(crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const savedNotes = entry?.notes;
  const savedFees = entry?.fees;
  useEffect(() => {
    if (savedNotes !== undefined) setNotes(savedNotes);
    if (savedFees !== undefined) setFees(String(savedFees));
  }, [savedNotes, savedFees]);
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
                quantity: (entry.quantity ?? 0) - (entry.exits ?? []).reduce((sum, exit) => sum + exit.quantity, 0),
                fees: Number(fees),
                occurredAt: new Date().toISOString(),
                reason: "manual",
              }
            : {
                notes,
                ...(action ? { status: action } : {}),
                ...(action === "open"
                  ? { entryPrice: Number(price), quantity: Number(quantity), fees: Number(fees) }
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
      ? risk / Math.abs(entry.plan.entry - entry.plan.stopLoss)
      : null;
  const profit = entry ? journalProfit(entry) : null;
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
              {entry.source === "ai" ? (
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <span>
                    Risk limit <strong>{entry.context.riskPercent}%</strong>
                    {risk !== null ? ` · ${chartPrice(risk)} ${entry.context.currency}` : " · capital not supplied"}
                  </span>
                  {size !== null ? (
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
                  Unleveraged base units from entry-to-stop distance; excludes fees, spread and slippage. Confirm your
                  broker's contract size.
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
              <section className="flex flex-col gap-3" aria-label="Actual execution">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h2 className="font-medium text-sm">Execution</h2>
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
                  {!action && (entry.status === "planned" || entry.status === "open") ? (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          setAction(entry.status === "planned" ? "open" : "closed");
                          setPrice("");
                          if (entry.status === "open") setFees("0");
                        }}
                      >
                        {entry.status === "planned" ? "Record entry" : "Record exit"}
                      </Button>
                      {entry.status === "planned" ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" disabled={pending} aria-label="Plan actions">
                              <Ellipsis />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem variant="destructive" onSelect={() => setAction("cancelled")}>
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
                    Entry {chartPrice(entry.entryPrice!)} · Quantity {entry.quantity} ·{" "}
                    {new Date(entry.openedAt).toLocaleString()}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    {entry.status === "planned"
                      ? entry.trackingMode === "automatic"
                        ? "Entry conditions are tracked automatically. Record your broker fill if you enter."
                        : "Waiting for your entry. Record the fill price and quantity after you trade."
                      : "This plan ended without a recorded entry."}
                  </p>
                )}
                {profit !== null ? (
                  <p className="font-semibold tabular-nums">
                    {entry.resultBasis === "estimated" ? "Estimated result" : "Recorded result"}{" "}
                    {profit >= 0 ? "+" : ""}
                    {chartPrice(profit)} {entry.plan.quote}
                    <span className="ml-2 font-normal text-muted-foreground text-xs">
                      {entry.resultBasis === "estimated"
                        ? "Candle-based estimate · after fees"
                        : "After recorded fees · not broker-verified"}
                    </span>
                  </p>
                ) : null}
                {action ? (
                  <FieldGroup className="grid gap-3 sm:grid-cols-2">
                    {action !== "cancelled" ? (
                      <>
                        <Field>
                          <FieldLabel htmlFor="execution-price">
                            Actual {action === "open" ? "entry" : "exit"} price · {entry.plan.quote}
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
                        {action === "open" ? (
                          <Field>
                            <FieldLabel htmlFor="execution-quantity">
                              Actual quantity · {entry.symbol.split("-")[0]}
                            </FieldLabel>
                            <Input
                              id="execution-quantity"
                              type="number"
                              step="any"
                              min="0.00000001"
                              value={quantity}
                              onChange={(e) => setQuantity(e.target.value)}
                              disabled={pending}
                            />
                          </Field>
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
                            disabled={pending}
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
                    ? "Candle-based estimates · verify against broker fills."
                    : "Recorded executions"}{" "}
                  · {entry.source} · {entry.trackingMode} tracking
                </p>
                <h2 className="font-medium text-sm">Timeline & AI review</h2>
                <p className="text-muted-foreground text-xs">
                  {entry.monitoringStatus ?? "Monitoring begins on the next scheduled check."}
                  {entry.checkedAt ? ` · Checked through ${new Date(entry.checkedAt).toLocaleString()}` : ""}
                </p>
                {entry.events.map((event) => (
                  <article key={event.id} className="flex flex-col gap-2 border-l-2 pl-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{event.kind}</Badge>
                      <time className="text-muted-foreground text-xs">
                        {new Date(event.occurredAt).toLocaleString()}
                      </time>
                    </div>
                    <p className="text-sm">{event.evidence.message}</p>
                    {event.evidence.source ? (
                      <p className="text-muted-foreground text-xs">
                        {event.evidence.source} · {event.evidence.interval} completed candle
                      </p>
                    ) : null}
                    {event.review ? (
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
      </SheetContent>
    </Sheet>
  );
}
