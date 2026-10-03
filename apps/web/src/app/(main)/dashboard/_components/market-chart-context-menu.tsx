"use client";

import { type ReactNode, useState } from "react";
import type { JournalRecord } from "@marketpilot/ai/contracts";
import type { MarketObservation } from "@marketpilot/market-data";
import { Bell, BookOpen, Focus, Pencil, Scan, Trash2, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/api/client";
import { AlertDetails } from "../alerts/_components/alert-details";
import type { AlertRecord } from "../alerts/_components/alert-types";
import { CreateAlert } from "../alerts/_components/create-alert";
import { AddTrade } from "../journal/_components/add-trade";
import { JournalDeleteTrade } from "../journal/_components/journal-delete-trade";
import type { JournalPosition } from "./market-chart-journal-layer";
import { chartDate, chartPrice } from "./market-chart-utils";
import type { AlertPosition } from "./use-interactive-market-chart";

type Point = { price: number; time: string };
type Target =
  | { kind: "space"; point: Point | null }
  | { kind: "alert"; rule: AlertRecord }
  | { kind: "trade"; trade: JournalRecord };
type Action =
  | { kind: "add-trade" | "add-alert"; point: Point }
  | { kind: "edit-trade" | "delete-trade"; trade: JournalRecord }
  | { kind: "edit-alert" | "delete-alert" | "alert-details"; rule: AlertRecord };
export function MarketChartContextMenu({
  children,
  data,
  geometry,
  alerts,
  journal,
  pointAt,
  focusAlert,
  focusTrade,
  reset,
  inspectAlert,
  inspectTrade,
  onOpen,
}: {
  children: ReactNode;
  data: MarketObservation;
  geometry: { positions: AlertPosition[]; journalPosition: JournalPosition | null; width: number; height: number };
  alerts: AlertRecord[];
  journal?: JournalRecord;
  pointAt: (x: number, y: number) => Point | null;
  focusAlert: (rule: AlertRecord) => void;
  focusTrade: () => void;
  reset: () => void;
  inspectAlert?: (id: string) => void;
  inspectTrade?: (id: string) => void;
  onOpen: () => void;
}) {
  const [target, setTarget] = useState<Target>({ kind: "space", point: null });
  const [action, setAction] = useState<Action | null>(null);
  const [pending, setPending] = useState(false);
  const close = () => setAction(null);
  const changed = () => {
    window.dispatchEvent(new Event("marketpilot:journal-changed"));
    window.dispatchEvent(new Event("marketpilot:alerts-changed"));
  };
  async function toggle(rule: AlertRecord) {
    if (pending) return;
    setPending(true);
    try {
      await apiRequest(`/alerts/${rule.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !rule.enabled }) });
      changed();
      toast.success(rule.enabled ? "Alert paused." : "Alert resumed. Waiting for a fresh baseline.");
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : "Alert could not be updated.");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <ContextMenu
        onOpenChange={(open) => {
          if (open) onOpen();
        }}
      >
        <ContextMenuTrigger asChild>
          <div
            className="relative isolate"
            onContextMenuCapture={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              const x = event.clientX - bounds.left;
              const y = event.clientY - bounds.top;
              const element = event.target instanceof Element ? event.target : null;
              const alertId = element?.closest<HTMLElement>("[data-chart-alert]")?.dataset.chartAlert;
              const tradeId = element?.closest<HTMLElement>("[data-chart-trade]")?.dataset.chartTrade;
              const point = pointAt(x, y);
              if (journal && tradeId === journal.id) {
                setTarget({ kind: "trade", trade: journal });
                return;
              }
              const line = point
                ? geometry.positions
                    .filter((position) => Math.abs(position.y - y) <= 7)
                    .sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y))[0]
                : undefined;
              const rule = alerts.find((item) => item.id === (alertId ?? line?.id));
              if (rule) {
                setTarget({ kind: "alert", rule });
                return;
              }
              const position = geometry.journalPosition;
              const withinTrade =
                point &&
                journal &&
                position &&
                ["open", "planned"].includes(journal.status) &&
                !journal.monitoringStatus?.startsWith("Needs review") &&
                x >= Math.min(position.x, position.endX) &&
                x <= Math.max(position.x, position.endX) &&
                y >= Math.min(position.entry, position.stop, ...position.targets) &&
                y <= Math.max(position.entry, position.stop, ...position.targets);
              if (journal && (tradeId === journal.id || withinTrade)) {
                setTarget({ kind: "trade", trade: journal });
                return;
              }
              setTarget({ kind: "space", point });
            }}
          >
            {children}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent
          className="min-w-60"
          onCloseAutoFocus={(event) => {
            if (action) event.preventDefault();
          }}
        >
          <ContextMenuGroup>
            <ContextMenuLabel>
              {target.kind === "alert"
                ? target.rule.name
                : target.kind === "trade"
                  ? `${data.symbol} · ${target.trade.plan.direction === "BUY" ? "Long" : "Short"}`
                  : target.point
                    ? `${chartPrice(target.point.price)} ${data.symbol.split("-").at(-1)}`
                    : "Chart view"}
            </ContextMenuLabel>
            {target.kind === "space" ? (
              <>
                {target.point ? (
                  <>
                    <ContextMenuLabel className="font-normal text-muted-foreground text-xs">
                      {chartDate(target.point.time)}
                    </ContextMenuLabel>
                    <ContextMenuItem
                      onSelect={() => {
                        if (target.point) setAction({ kind: "add-alert", point: target.point });
                      }}
                    >
                      <Bell />
                      Create alert at this price
                    </ContextMenuItem>
                    <ContextMenuItem
                      onSelect={() => {
                        if (target.point) setAction({ kind: "add-trade", point: target.point });
                      }}
                    >
                      <BookOpen />
                      Add trade here
                    </ContextMenuItem>
                  </>
                ) : null}
              </>
            ) : target.kind === "alert" ? (
              <>
                <ContextMenuItem
                  onSelect={() =>
                    inspectAlert
                      ? inspectAlert(target.rule.id)
                      : setAction({ kind: "alert-details", rule: target.rule })
                  }
                >
                  <Bell />
                  View alert details
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => focusAlert(target.rule)}>
                  <Focus />
                  Focus on alert
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => setAction({ kind: "edit-alert", rule: target.rule })}>
                  <Pencil />
                  Edit alert
                </ContextMenuItem>
                <ContextMenuItem disabled={pending} onSelect={() => void toggle(target.rule)}>
                  {target.rule.enabled ? <Pause /> : <Play />}
                  {target.rule.enabled ? "Pause alert" : "Resume alert"}
                </ContextMenuItem>
                <ContextMenuItem
                  variant="destructive"
                  onSelect={() => setAction({ kind: "delete-alert", rule: target.rule })}
                >
                  <Trash2 />
                  Delete alert
                </ContextMenuItem>
              </>
            ) : (
              <>
                {inspectTrade ? (
                  <ContextMenuItem onSelect={() => inspectTrade(target.trade.id)}>
                    <BookOpen />
                    View trade details
                  </ContextMenuItem>
                ) : null}
                <ContextMenuItem onSelect={focusTrade}>
                  <Focus />
                  Focus on trade
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => setAction({ kind: "edit-trade", trade: target.trade })}>
                  <Pencil />
                  Edit trade
                </ContextMenuItem>
                <ContextMenuItem
                  variant="destructive"
                  onSelect={() => setAction({ kind: "delete-trade", trade: target.trade })}
                >
                  <Trash2 />
                  Delete trade
                </ContextMenuItem>
              </>
            )}
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <ContextMenuItem onSelect={reset}>
              <Scan />
              Reset chart view
            </ContextMenuItem>
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>
      {action?.kind === "add-trade" ? (
        <AddTrade
          close={close}
          saved={changed}
          initial={{ symbol: data.symbol, interval: data.interval, ...action.point }}
        />
      ) : null}
      {action?.kind === "edit-trade" ? <AddTrade trade={action.trade} close={close} saved={changed} /> : null}
      {action?.kind === "delete-trade" ? (
        <JournalDeleteTrade entry={action.trade} close={close} changed={changed} />
      ) : null}
      {action?.kind === "add-alert" ? (
        <CreateAlert
          close={close}
          saved={changed}
          initial={{
            asset: data.symbol,
            threshold: String(action.point.price),
            interval: data.interval,
            condition: action.point.price >= data.price ? "PRICE_ABOVE" : "PRICE_BELOW",
          }}
        />
      ) : null}
      {action?.kind === "edit-alert" ? <CreateAlert edit={action.rule} close={close} saved={changed} /> : null}
      {action?.kind === "alert-details" ? (
        <AlertDetails id={action.rule.id} close={close} presentation="sheet" />
      ) : null}
      {action?.kind === "delete-alert" ? <DeleteChartAlert rule={action.rule} close={close} changed={changed} /> : null}
    </>
  );
}
function DeleteChartAlert({ rule, close, changed }: { rule: AlertRecord; close: () => void; changed: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function remove() {
    setPending(true);
    setError(null);
    try {
      await apiRequest(`/alerts/${rule.id}`, { method: "DELETE" });
      changed();
      close();
      toast.success("Alert deleted.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Alert could not be deleted.");
    } finally {
      setPending(false);
    }
  }
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) close();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {rule.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the alert and stops future notifications. Journal trades remain independent.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep alert</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              void remove();
            }}
          >
            {pending ? "Deleting…" : "Delete alert"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
