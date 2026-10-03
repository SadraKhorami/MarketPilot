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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiRequest } from "@/lib/api/client";
import { JournalDeleteTrade } from "./journal-delete-trade";
import { AddTrade } from "./add-trade";
import { localDate } from "./journal-dates";

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
            <DropdownMenuItem onSelect={() => setEditing(true)}>Edit trade</DropdownMenuItem>
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
              <DropdownMenuItem onSelect={() => setAction("manual")}>Record broker result</DropdownMenuItem>
            ) : null}
            {entry.status === "open" ? (
              <>
                <DropdownMenuItem onSelect={() => setAction("tp")}>Record take profit / partial exit</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setAction("sl")}>Record stop loss execution</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setAction("manual")}>Close at another price</DropdownMenuItem>
              </>
            ) : entry.status === "planned" ? (
              <>
                <DropdownMenuItem onSelect={view}>Record actual entry</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setAction("cancelled")}>Cancel waiting plan</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setAction("expired")}>Mark waiting plan expired</DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
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
  const remaining =
    (entry.quantity ?? 0) -
    (entry.exits ?? [])
      .filter((exit) => !reconcile || exit.basis === "recorded")
      .reduce((sum, e) => sum + e.quantity, 0);
  const [price, setPrice] = useState(
    action === "sl" ? String(entry.plan.stopLoss) : action === "tp" ? String(entry.plan.targets[0]) : "",
  );
  const [quantity, setQuantity] = useState(String(remaining));
  const [fees, setFees] = useState("0");
  const [time, setTime] = useState(() => localDate(new Date()));
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
                price: Number(price),
                quantity: Number(quantity),
                fees: Number(fees),
                occurredAt: new Date(time).toISOString(),
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
                ? "Replace estimated exits with broker records. Previous observations remain in the timeline."
                : "Use broker values. A partial exit leaves the remaining quantity open."
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
              {[
                ["price", `Actual exit price · ${entry.plan.quote}`, price, setPrice],
                ["quantity", `Exit quantity · ${remaining} remaining`, quantity, setQuantity],
                ["fees", `Exit fees · ${entry.plan.quote}`, fees, setFees],
              ].map(([id, label, value, setter]) => (
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
                </Field>
              ))}
              <Field>
                <FieldLabel htmlFor="exit-date">Execution time</FieldLabel>
                <Input
                  required
                  id="exit-date"
                  type="datetime-local"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  disabled={pending}
                />
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
