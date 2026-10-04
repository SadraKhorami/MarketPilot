"use client";
import { useRef, useState } from "react";
import type { JournalRecord } from "@marketpilot/ai/contracts";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiRequest } from "@/lib/api/client";
import { JournalDeleteTrade } from "./journal-delete-trade";
import { JournalExecutionEditor } from "./journal-execution-editor";
import { AddTrade } from "./add-trade";
import { localDate } from "./journal-dates";
import { JournalDatePicker } from "./journal-date-picker";
import { TradeSizeField, useTradeSize } from "./trade-size-field";

export function JournalActions({
  entry,
  view,
  changed,
}: {
  entry: JournalRecord;
  view: () => void;
  changed: () => void;
}) {
  const [action, setAction] = useState<"tp" | "sl" | "manual" | "cancelled" | "expired" | null>(null);
  const [editing, setEditing] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  async function archive() {
    setArchiving(true);
    try {
      await apiRequest(`/journal/${entry.id}/archive`, {
        method: "POST",
        body: JSON.stringify({ archived: !entry.archivedAt }),
      });
      changed();
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : "Archive unavailable.");
    } finally {
      setArchiving(false);
    }
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${entry.symbol}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={view}>Details & timeline</DropdownMenuItem>
            {!entry.plan.conditionalEntry ? (
              <DropdownMenuItem onSelect={() => setEditing(true)}>Edit trade</DropdownMenuItem>
            ) : null}
            {entry.plan.conditionalEntry && entry.openedAt ? (
              <DropdownMenuItem onSelect={() => setCorrecting(true)}>Correct actual entry</DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                setDeleting(true);
              }}
            >
              Delete trade
            </DropdownMenuItem>
            {entry.archivedAt || ["closed", "expired", "cancelled"].includes(entry.status) ? (
              <DropdownMenuItem disabled={archiving} onSelect={() => void archive()}>
                {entry.archivedAt ? "Restore to journal" : "Archive trade"}
              </DropdownMenuItem>
            ) : null}
            {entry.status === "closed" && entry.resultBasis === "estimated" ? (
              <DropdownMenuItem onSelect={() => setAction("manual")}>Adjust simulation result</DropdownMenuItem>
            ) : null}
            {entry.status === "open" ? (
              <>
                <DropdownMenuItem onSelect={() => setAction("tp")}>Record take profit / partial exit</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setAction("sl")}>Record stop loss</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setAction("manual")}>Close at another price</DropdownMenuItem>
              </>
            ) : entry.status === "planned" ? (
              <>
                <DropdownMenuItem onSelect={view}>View entry conditions</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setAction("cancelled")}>Cancel waiting plan</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setAction("expired")}>Mark waiting plan expired</DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {correcting ? (
        <JournalExecutionEditor entry={entry} close={() => setCorrecting(false)} changed={changed} />
      ) : null}
      {editing ? <AddTrade trade={entry} close={() => setEditing(false)} saved={changed} /> : null}
      {deleting ? <JournalDeleteTrade entry={entry} close={() => setDeleting(false)} changed={changed} /> : null}
      {action ? (
        <JournalActionSheet entry={entry} action={action} close={() => setAction(null)} changed={changed} />
      ) : null}
    </>
  );
}
function JournalActionSheet({
  entry,
  action,
  close,
  changed,
}: {
  entry: JournalRecord;
  action: "tp" | "sl" | "manual" | "cancelled" | "expired";
  close: () => void;
  changed: () => void;
}) {
  const reconcile = entry.status === "closed" && entry.resultBasis === "estimated";
  const referenceSimulation =
    !reconcile && entry.source === "ai" && entry.resultBasis === "estimated" && entry.quantity === null;
  const remaining =
    (entry.quantity ?? (referenceSimulation ? 1 : 0)) -
    (entry.exits ?? [])
      .filter((exit) => !reconcile || exit.basis === "recorded")
      .reduce((sum, e) => sum + e.quantity, 0);
  const [price, setPrice] = useState(
    action === "sl" ? String(entry.plan.stopLoss) : action === "tp" ? String(entry.plan.targets[0]) : "",
  );
  const [actualEntryPrice, setActualEntryPrice] = useState(String(entry.entryPrice ?? entry.plan.entry));
  const entrySize = useTradeSize(actualEntryPrice, String(entry.quantity ?? remaining));
  const [entryFees, setEntryFees] = useState(String(entry.fees));
  const [entryTime, setEntryTime] = useState(localDate(new Date(entry.openedAt ?? entry.createdAt)));
  const size = useTradeSize(String(entry.entryPrice ?? entry.plan.entry), String(remaining));
  const [exitPercent, setExitPercent] = useState("100");
  const quantity = referenceSimulation ? String((remaining * Number(exitPercent)) / 100) : size.quantity;
  const [fees, setFees] = useState("0");
  const instant = useRef(new Date());
  const [time, setTime] = useState(() => localDate(instant.current));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(crypto.randomUUID());
  const execution = action === "tp" || action === "sl" || action === "manual";
  async function save() {
    setPending(true);
    setError(null);
    try {
      await apiRequest(`/journal/${entry.id}/${execution ? "exits" : "transition"}`, {
        method: "POST",
        body: JSON.stringify(
          execution
            ? {
                requestId: requestId.current,
                reconcile,
                ...(reconcile
                  ? {
                      actualEntry: {
                        price: Number(actualEntryPrice),
                        quantity: Number(entrySize.quantity),
                        fees: Number(entryFees),
                        occurredAt:
                          entryTime === localDate(new Date(entry.openedAt ?? entry.createdAt))
                            ? (entry.openedAt ?? entry.createdAt)
                            : new Date(entryTime).toISOString(),
                      },
                    }
                  : {}),
                price: Number(price),
                quantity: Number(quantity),
                fees: Number(fees),
                occurredAt:
                  time === localDate(instant.current) ? instant.current.toISOString() : new Date(time).toISOString(),
                reason: action,
              }
            : { status: action, confirm: true },
        ),
      });
      changed();
      window.dispatchEvent(new Event("marketpilot:journal-changed"));
      close();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Trade could not be updated.");
    } finally {
      setPending(false);
    }
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !pending) close();
      }}
    >
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {execution ? "Record execution" : "Update waiting plan"} · {entry.symbol}
          </SheetTitle>
          <SheetDescription>
            {execution
              ? reconcile
                ? "Adjust the simulated entry and exit. Earlier candle observations remain in the timeline."
                : "Enter your exit values. A partial exit leaves the remaining quantity open."
              : "Only an unexecuted plan is affected. No profit or loss is recorded."}
          </SheetDescription>
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {execution ? (
            <FieldGroup>
              {action === "tp" ? (
                <Field>
                  <FieldLabel htmlFor="exit-target">Fill from target · editable</FieldLabel>
                  <Select onValueChange={(value) => setPrice(value)}>
                    <SelectTrigger id="exit-target" className="w-full">
                      <SelectValue placeholder="Choose target price" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {entry.plan.targets.map((target, i) => (
                          <SelectItem key={target} value={String(target)}>
                            TP {i + 1} · {target}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}
              {reconcile ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="reconcile-entry-price">Actual entry price · {entry.plan.quote}</FieldLabel>
                    <Input
                      id="reconcile-entry-price"
                      type="number"
                      min="0.00000001"
                      step="any"
                      required
                      disabled={pending}
                      value={actualEntryPrice}
                      onChange={(event) => setActualEntryPrice(event.target.value)}
                    />
                  </Field>
                  <TradeSizeField
                    id="reconcile-position"
                    symbol={entry.symbol}
                    price={actualEntryPrice}
                    size={entrySize}
                    disabled={pending}
                  />
                  <Field>
                    <FieldLabel htmlFor="reconcile-entry-fees">Actual entry fees · {entry.plan.quote}</FieldLabel>
                    <Input
                      id="reconcile-entry-fees"
                      type="number"
                      min="0"
                      step="any"
                      required
                      disabled={pending}
                      value={entryFees}
                      onChange={(event) => setEntryFees(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="reconcile-entry-time">Actual entry time</FieldLabel>
                    <JournalDatePicker
                      id="reconcile-entry-time"
                      value={entryTime}
                      onChange={setEntryTime}
                      disabled={pending}
                    />
                  </Field>
                </>
              ) : null}
              {referenceSimulation ? (
                <Field data-disabled={pending}>
                  <FieldLabel htmlFor="exit-percent">Close remaining position · %</FieldLabel>
                  <Input
                    id="exit-percent"
                    type="number"
                    min="0.01"
                    max="100"
                    step="any"
                    required
                    disabled={pending}
                    value={exitPercent}
                    onChange={(event) => setExitPercent(event.target.value)}
                  />
                  <FieldDescription>
                    Percentage simulation. Saved estimated costs are included; set a position amount for monetary
                    results.
                  </FieldDescription>
                </Field>
              ) : (
                <TradeSizeField
                  id="exit-quantity"
                  symbol={entry.symbol}
                  price={String(entry.entryPrice ?? entry.plan.entry)}
                  size={size}
                  disabled={pending}
                  label="Exit size"
                />
              )}
              {!referenceSimulation ? (
                <p className="text-muted-foreground text-xs">
                  {remaining.toLocaleString(undefined, { maximumSignificantDigits: 10 })} {entry.symbol.split("-")[0]}{" "}
                  remaining{reconcile ? " before entry correction" : ""}.
                </p>
              ) : null}
              {[
                ["price", `Actual exit price · ${entry.plan.quote}`, price, setPrice],
                ["fees", `Exit fees · ${entry.plan.quote}`, fees, setFees],
              ]
                .filter(([id]) => !referenceSimulation || id !== "fees")
                .map(([id, label, value, setter]) => (
                  <Field key={String(id)}>
                    <FieldLabel htmlFor={`exit-${id}`}>{String(label)}</FieldLabel>
                    <Input
                      required
                      id={`exit-${id}`}
                      type="number"
                      step="any"
                      min={id === "fees" ? 0 : "0.00000001"}
                      value={String(value)}
                      onChange={(e) => {
                        if (typeof setter === "function") setter(e.target.value);
                      }}
                      disabled={pending}
                    />
                    {id === "fees" ? (
                      <FieldDescription>
                        Manual exits use this cost. Automatic exits use your saved estimate.
                      </FieldDescription>
                    ) : null}
                  </Field>
                ))}
              <Field>
                <FieldLabel htmlFor="exit-date">Execution time</FieldLabel>
                <JournalDatePicker id="exit-date" value={time} onChange={setTime} disabled={pending} />
              </Field>
            </FieldGroup>
          ) : (
            <p>Mark this waiting plan {action}?</p>
          )}
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <div className="mt-auto flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={pending} onClick={close}>
              Back
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Confirm update"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
