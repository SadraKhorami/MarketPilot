"use client";

import { useState } from "react";
import type { JournalRecord } from "@marketpilot/ai/contracts";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ApiError, apiRequest, type ApiEnvelope } from "@/lib/api/client";
import { localDate } from "./journal-dates";
import { JournalDatePicker } from "./journal-date-picker";
import { TradeSizeField, useTradeSize } from "./trade-size-field";

export function JournalExecutionEditor({
  entry,
  close,
  changed,
}: {
  entry: JournalRecord;
  close: () => void;
  changed: () => void;
}) {
  const [latest, setLatest] = useState(entry);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest<ApiEnvelope<JournalRecord>>(`/journal/${entry.id}`);
      setLatest(response.data);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Trade unavailable.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !busy && !loading) close();
      }}
    >
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Edit position · {latest.symbol}</SheetTitle>
          <SheetDescription>
            Set the position amount or correct the recorded entry. Original entry rules, SL/TP and existing exits are
            preserved.
          </SheetDescription>
        </SheetHeader>
        {error ? (
          <p role="alert" className="text-destructive px-4 text-sm">
            {error}
          </p>
        ) : null}
        <ExecutionForm
          key={latest.editVersion ?? latest.updatedAt}
          entry={latest}
          close={close}
          changed={changed}
          reload={reload}
          loading={loading}
          onPendingChange={setBusy}
        />
      </SheetContent>
    </Sheet>
  );
}
function ExecutionForm({
  entry,
  close,
  changed,
  reload,
  loading,
  onPendingChange,
}: {
  entry: JournalRecord;
  close: () => void;
  changed: () => void;
  reload: () => Promise<void>;
  loading: boolean;
  onPendingChange: (value: boolean) => void;
}) {
  const [price, setPrice] = useState(String(entry.entryPrice ?? entry.plan.entry));
  const size = useTradeSize(price, String(entry.quantity ?? ""));
  const [fees, setFees] = useState(String(entry.fees));
  const originalTime = entry.openedAt ?? entry.createdAt;
  const [time, setTime] = useState(localDate(new Date(originalTime)));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  async function save() {
    if (pending) return;
    setPending(true);
    onPendingChange(true);
    setError(null);
    try {
      await apiRequest(`/journal/${entry.id}/execution`, {
        method: "PATCH",
        body: JSON.stringify({
          editVersion: entry.editVersion,
          price: Number(price),
          quantity: Number(size.quantity),
          fees: Number(fees),
          occurredAt: time === localDate(new Date(originalTime)) ? originalTime : new Date(time).toISOString(),
        }),
      });
      changed();
      window.dispatchEvent(new Event("marketpilot:journal-changed"));
      close();
    } catch (failure) {
      setConflict(failure instanceof ApiError && failure.status === 409);
      setError(failure instanceof Error ? failure.message : "Entry could not be corrected.");
    } finally {
      setPending(false);
      onPendingChange(false);
    }
  }
  return (
    <form
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="correct-entry-price">Entry price · {entry.plan.quote}</FieldLabel>
          <Input
            id="correct-entry-price"
            type="number"
            min="0.00000001"
            step="any"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            required
            disabled={pending || loading}
          />
        </Field>
        <TradeSizeField
          id="correct-entry-size"
          symbol={entry.symbol}
          price={price}
          size={size}
          disabled={pending || loading}
        />
        <Field>
          <FieldLabel htmlFor="correct-entry-fees">Entry fees · {entry.plan.quote}</FieldLabel>
          <Input
            id="correct-entry-fees"
            type="number"
            min="0"
            step="any"
            value={fees}
            onChange={(event) => setFees(event.target.value)}
            required
            disabled={pending || loading}
          />
          {entry.plan.conditionalEntry?.economics ? (
            <FieldDescription>
              This cost is counted inside the saved round-trip budget. Estimated exit costs update when you save.
            </FieldDescription>
          ) : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="correct-entry-time">Entry time</FieldLabel>
          <JournalDatePicker id="correct-entry-time" value={time} onChange={setTime} disabled={pending || loading} />
        </Field>
      </FieldGroup>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {conflict ? (
        <Button type="button" variant="outline" disabled={pending || loading} onClick={() => void reload()}>
          Load latest trade · discard edits
        </Button>
      ) : null}
      <div className="mt-auto flex justify-end gap-2">
        <Button type="button" variant="ghost" disabled={pending || loading} onClick={close}>
          Back
        </Button>
        <Button type="submit" disabled={pending || loading || conflict}>
          {pending ? "Saving…" : "Save position"}
        </Button>
      </div>
    </form>
  );
}
