"use client";
import { useRef, useState } from "react";
import { ManualTradeSchema, type JournalRecord } from "@marketpilot/ai/contracts";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { TradeSizeField, useTradeSize } from "./trade-size-field";
import { ApiError, type ApiEnvelope, apiRequest } from "@/lib/api/client";
import { MarketSymbolField } from "../../_components/market-symbol-field";

import { localDate } from "./journal-dates";
import { JournalDatePicker } from "./journal-date-picker";

function Choice({
  id,
  label,
  value,
  values,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  values: Array<[string, string]>;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {values.map(([v, text]) => (
              <SelectItem key={v} value={v}>
                {text}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}
function AddTradeForm({
  close,
  saved,
  trade,
  initial,
  reload,
}: {
  reload?: () => Promise<void>;
  close: () => void;
  saved: () => void;
  trade?: JournalRecord;
  initial?: { symbol: string; price: number; time: string; interval: string };
}) {
  const [symbol, setSymbol] = useState(trade?.symbol ?? initial?.symbol ?? "BTC-USD");
  const [direction, setDirection] = useState<string>(trade?.plan.direction ?? "BUY");
  const [status, setStatus] = useState<string>(
    trade?.status ?? (initial && Date.parse(initial.time) > Date.now() ? "planned" : "open"),
  );
  const [interval, setInterval] = useState<string>(trade?.plan.interval ?? initial?.interval ?? "15m");
  const [trackingMode, setTrackingMode] = useState<string>(trade?.trackingMode ?? "automatic");
  const [entryTrigger, setEntryTrigger] = useState<string>(trade?.entryTrigger ?? "touch");
  const [startedAt, setStartedAt] = useState(() =>
    localDate(
      new Date(
        trade?.openedAt ??
          trade?.createdAt ??
          (initial && Date.parse(initial.time) <= Date.now() ? initial.time : Date.now()),
      ),
    ),
  );
  const [expiresAt, setExpiresAt] = useState(() =>
    localDate(
      new Date(
        trade?.plan.expiresAt ?? (initial ? Math.max(Date.parse(initial.time), Date.now()) : Date.now()) + 86400_000,
      ),
    ),
  );
  const [closedAt, setClosedAt] = useState(() => localDate(new Date(trade?.closedAt ?? Date.now())));
  const [entry, setEntry] = useState(
    trade ? String(trade.entryPrice ?? trade.plan.entry) : initial ? String(initial.price) : "",
  );
  const [stopLoss, setStopLoss] = useState(trade ? String(trade.plan.stopLoss) : "");
  const size = useTradeSize(entry, trade?.quantity ? String(trade.quantity) : "");
  const quantity = size.quantity;
  const [fees, setFees] = useState(String(trade?.fees ?? 0));
  const [exitPrice, setExitPrice] = useState(trade?.exitPrice ? String(trade.exitPrice) : "");
  const [exitReason, setExitReason] = useState(trade?.exits?.at(-1)?.reason ?? "manual");
  const [notes, setNotes] = useState(trade?.notes ?? "");
  const [targets, setTargets] = useState(() =>
    trade
      ? trade.plan.targets.map((price, i) => ({
          id: crypto.randomUUID(),
          price: String(price),
          percent: String(trade.targetAllocations[i] ?? 100 / trade.plan.targets.length),
        }))
      : [{ id: crypto.randomUUID(), price: "", percent: "100" }],
  );
  const [pending, setPending] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(crypto.randomUUID());
  async function save() {
    if (pending) return;
    try {
      const parsed = ManualTradeSchema.safeParse({
        symbol,
        direction,
        status,
        interval,
        entry: Number(entry),
        stopLoss: Number(stopLoss),
        quantity: Number(quantity),
        fees: Number(fees),
        startedAt:
          trade && startedAt === localDate(new Date(trade.openedAt ?? trade.createdAt))
            ? (trade.openedAt ?? trade.createdAt)
            : new Date(startedAt).toISOString(),
        expiresAt:
          trade && expiresAt === localDate(new Date(trade.plan.expiresAt))
            ? trade.plan.expiresAt
            : new Date(expiresAt).toISOString(),
        closedAt:
          status === "closed"
            ? trade?.closedAt && closedAt === localDate(new Date(trade.closedAt))
              ? trade.closedAt
              : new Date(closedAt).toISOString()
            : null,
        exitPrice: status === "closed" ? Number(exitPrice) : null,
        exitReason,
        trackingMode,
        entryTrigger,
        notes,
        targets: targets.map((t) => Number(t.price)),
        targetAllocations: targets.map((t) => Number(t.percent)),
      });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Check the trade fields.");
        return;
      }
      setPending(true);
      setError(null);
      await apiRequest(trade ? `/journal/${trade.id}/trade` : "/journal/manual", {
        method: trade ? "PATCH" : "POST",
        headers: { "X-Request-Id": requestId.current },
        body: JSON.stringify(
          trade ? { trade: parsed.data, updatedAt: trade.updatedAt, editVersion: trade.editVersion } : parsed.data,
        ),
      });
      saved();
      close();
      window.dispatchEvent(new Event("marketpilot:journal-changed"));
    } catch (failure) {
      setConflict(
        failure instanceof ApiError && failure.status === 409 && failure.message.startsWith("Trade details changed"),
      );
      setError(failure instanceof Error ? failure.message : "Check the dates and trade details.");
    } finally {
      setPending(false);
    }
  }
  const numberFields = [
    ["entry", "Entry price", entry, setEntry],
    ["stop", "Stop loss", stopLoss, setStopLoss],
  ] as const;
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !pending) close();
      }}
    >
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{trade ? `Edit trade · ${trade.symbol}` : "Add a trade"}</SheetTitle>
          <SheetDescription>
            {trade ? "Update your position, targets and notes." : "Record a trade or a waiting plan."}
          </SheetDescription>
          {initial && Date.parse(initial.time) > Date.now() ? (
            <p className="text-muted-foreground text-xs">
              The selected chart time is in the future. This starts as a waiting plan now; record its actual entry when
              executed.
            </p>
          ) : null}
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <fieldset disabled={pending} className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
            <FieldSet>
              <FieldLegend>Trade details</FieldLegend>
              <FieldGroup className="grid items-start gap-4 sm:grid-cols-2">
                {trade?.exits.length ? (
                  <p className="text-muted-foreground text-sm sm:col-span-2">
                    {direction === "BUY" ? "Long" : "Short"} · {status === "closed" ? "Closed" : "Open"} ·{" "}
                    {trade.resultBasis === "estimated" ? "Simulated position" : "Recorded trade"}
                  </p>
                ) : (
                  <>
                    <Field className="sm:col-span-2">
                      <FieldLabel htmlFor="manual-market">Market</FieldLabel>
                      <MarketSymbolField
                        id="manual-market"
                        value={symbol}
                        onChange={setSymbol}
                        disabled={pending || !!trade?.exits.length}
                      />
                    </Field>
                    <Choice
                      id="manual-direction"
                      disabled={!!trade?.exits.length}
                      label="Side"
                      value={direction}
                      onChange={setDirection}
                      values={[
                        ["BUY", "Long"],
                        ["SELL", "Short"],
                      ]}
                    />
                    <Choice
                      id="manual-status"
                      disabled={!!trade?.exits.length}
                      label="Current status"
                      value={status}
                      onChange={setStatus}
                      values={
                        trade?.openedAt
                          ? [
                              ["open", "Entered trade"],
                              ["closed", "Already closed"],
                            ]
                          : [
                              ["open", "Entered trade"],
                              ["planned", "Waiting for entry"],
                              ["closed", "Already closed"],
                              ["cancelled", "Cancelled plan"],
                              ["expired", "Expired plan"],
                            ]
                      }
                    />
                  </>
                )}
                <Field>
                  <FieldLabel htmlFor="manual-start">{status === "planned" ? "Plan start" : "Entry time"}</FieldLabel>
                  <JournalDatePicker id="manual-start" value={startedAt} onChange={setStartedAt} />
                </Field>
                <Choice
                  id="manual-interval"
                  label="Tracking timeframe"
                  value={interval}
                  onChange={setInterval}
                  values={["1m", "5m", "15m", "1h", "6h", "1d"].map((v) => [v, v])}
                />
              </FieldGroup>
            </FieldSet>
            <FieldSet className="border-t pt-5">
              <FieldLegend>Position</FieldLegend>
              <FieldGroup className="grid items-start gap-4 sm:grid-cols-2">
                {numberFields.map(([id, label, value, setter]) => (
                  <Field key={id}>
                    <FieldLabel htmlFor={`manual-${id}`}>{label}</FieldLabel>
                    <Input
                      required
                      id={`manual-${id}`}
                      type="number"
                      min="0.00000001"
                      step="any"
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                    />
                  </Field>
                ))}
                <div className="sm:col-span-2">
                  <TradeSizeField id="manual-quantity" symbol={symbol} price={entry} size={size} disabled={pending} />
                </div>
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="manual-fees">
                    {status === "closed" && !trade ? "Total fees" : "Entry fee"} · {symbol.split("-").at(-1)}
                  </FieldLabel>
                  <Input
                    id="manual-fees"
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={fees}
                    onChange={(event) => setFees(event.target.value)}
                  />
                  <FieldDescription>
                    {status === "closed" && !trade
                      ? "Combined entry and exit costs."
                      : "Cost of opening this position."}{" "}
                    Leave at 0 for a simulation without fees.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </FieldSet>
            <FieldSet className="border-t pt-5">
              <FieldLegend>Take-profit targets</FieldLegend>
              <FieldGroup className="gap-4">
                <Field className="sm:col-span-2">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>Target price</span>
                    <span>Position to close · %</span>
                  </div>
                  <FieldDescription>Allocate 100% across up to three targets.</FieldDescription>
                  {targets.map((target, i) => (
                    <div key={target.id} className="flex items-center gap-2">
                      <Input
                        aria-label={`Target ${i + 1} price`}
                        placeholder={`TP ${i + 1} price`}
                        required
                        type="number"
                        min="0.00000001"
                        step="any"
                        value={target.price}
                        onChange={(e) =>
                          setTargets((all) => all.map((t, n) => (n === i ? { ...t, price: e.target.value } : t)))
                        }
                      />
                      <Input
                        className="w-24"
                        aria-label={`Target ${i + 1} exit percent`}
                        required
                        type="number"
                        min="0.01"
                        max="100"
                        step="any"
                        readOnly={!!trade?.exits.length}
                        value={target.percent}
                        onChange={(e) =>
                          setTargets((all) => all.map((t, n) => (n === i ? { ...t, percent: e.target.value } : t)))
                        }
                      />
                      <span>%</span>
                      {targets.length > 1 && !trade?.exits.length ? (
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Remove target ${i + 1}`}
                          onClick={() => setTargets((all) => all.filter((_, n) => n !== i))}
                        >
                          <Trash2 />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  {targets.length < 3 && !trade?.exits.length ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="self-start"
                      onClick={() => setTargets((all) => [...all, { id: crypto.randomUUID(), price: "", percent: "" }])}
                    >
                      <Plus data-icon="inline-start" />
                      Add target
                    </Button>
                  ) : null}
                </Field>
              </FieldGroup>
            </FieldSet>
            {status === "planned" || status === "open" ? (
              <FieldSet className="border-t pt-5">
                <FieldLegend>Tracking & validity</FieldLegend>
                <FieldGroup className="grid items-start gap-4 sm:grid-cols-2">
                  {status === "planned" ? (
                    <>
                      <Choice
                        id="manual-trigger"
                        label="Entry condition"
                        value={entryTrigger}
                        onChange={setEntryTrigger}
                        values={[
                          ["touch", "Price touches entry"],
                          ["close_above", "Candle closes above entry"],
                          ["close_below", "Candle closes below entry"],
                        ]}
                      />
                      <Field>
                        <FieldLabel htmlFor="manual-expiry">Entry valid until</FieldLabel>
                        <JournalDatePicker id="manual-expiry" value={expiresAt} onChange={setExpiresAt} />
                        <FieldDescription>No entry before this time → expired.</FieldDescription>
                      </Field>
                    </>
                  ) : null}
                  {status === "open" || status === "planned" ? (
                    <Field className="sm:col-span-2">
                      <Choice
                        id="manual-tracking"
                        disabled={trade?.exits.some((exit) => exit.basis === "recorded")}
                        label="Tracking"
                        value={trackingMode}
                        onChange={setTrackingMode}
                        values={[
                          ["automatic", "Automatic · candle-based estimates"],
                          ["observed", "Observe levels · I record executions"],
                        ]}
                      />
                      <FieldDescription>
                        Automatic simulation tracks SL/TP exits using these allocations. Unclear candles pause tracking
                        for review.
                      </FieldDescription>
                    </Field>
                  ) : null}
                </FieldGroup>
              </FieldSet>
            ) : null}
            {status === "closed" ? (
              <FieldSet className="border-t pt-5">
                <FieldLegend>Closed result</FieldLegend>
                {(trade?.exits.length ?? 0) > 1 ? (
                  <FieldDescription>
                    Exit price is the average of your partial exits; their prices and times are preserved.
                  </FieldDescription>
                ) : null}
                <FieldGroup className="grid items-start gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="manual-exit-price">Exit price</FieldLabel>
                    <Input
                      required
                      id="manual-exit-price"
                      readOnly={(trade?.exits.length ?? 0) > 1}
                      type="number"
                      step="any"
                      min="0.00000001"
                      value={exitPrice}
                      onChange={(e) => setExitPrice(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="manual-exit-time">Exit time</FieldLabel>
                    <JournalDatePicker
                      id="manual-exit-time"
                      readOnly={(trade?.exits.length ?? 0) > 1}
                      value={closedAt}
                      onChange={setClosedAt}
                    />
                  </Field>
                  <Choice
                    id="manual-exit-reason"
                    label="Exit reason"
                    value={exitReason}
                    onChange={setExitReason}
                    values={[
                      ["tp", "Take profit"],
                      ["sl", "Stop loss"],
                      ["manual", "Other exit"],
                    ]}
                  />
                </FieldGroup>
              </FieldSet>
            ) : null}
            <Field className="border-t pt-5">
              <FieldLabel htmlFor="manual-notes">Notes · optional</FieldLabel>
              <Textarea
                id="manual-notes"
                maxLength={4000}
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
            {conflict && reload ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  try {
                    await reload();
                  } catch (failure) {
                    setError(failure instanceof Error ? failure.message : "Could not load the trade.");
                  } finally {
                    setPending(false);
                  }
                }}
              >
                Load latest trade · discard edits
              </Button>
            ) : null}
            {error ? (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            ) : null}
          </fieldset>
          <div className="flex justify-end gap-2 border-t p-4">
            <Button type="button" variant="ghost" disabled={pending} onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save trade"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function AddTrade(props: Parameters<typeof AddTradeForm>[0]) {
  const [trade, setTrade] = useState(props.trade);
  return (
    <AddTradeForm
      {...props}
      trade={trade}
      key={trade?.editVersion ?? trade?.updatedAt ?? "new"}
      reload={
        trade
          ? async () => {
              const response = await apiRequest<ApiEnvelope<JournalRecord>>(`/journal/${trade.id}`);
              setTrade(response.data);
            }
          : undefined
      }
    />
  );
}
