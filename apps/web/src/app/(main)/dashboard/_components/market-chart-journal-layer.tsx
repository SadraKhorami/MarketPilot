"use client";
import type { JournalRecord } from "@marketpilot/ai/contracts";
import { BookOpen } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

import { ConditionalEntrySummary } from "./conditional-entry-summary";
import type { PlacedChartMarker } from "./market-chart-markers";
import { chartDate, chartPrice } from "./market-chart-utils";
export interface JournalPosition {
  id: string;
  x: number;
  endX: number;
  entry: number;
  stop: number;
  targets: number[];
}
export function journalChartWindow(entry: JournalRecord, latestTime: string) {
  const start = Date.parse(entry.openedAt ?? entry.createdAt);
  const inactiveTime = entry.events?.find(
    (event) =>
      event.kind === entry.status ||
      (entry.status === "expired" && event.kind === "invalidated") ||
      (entry.status === "cancelled" && event.kind === "replaced"),
  )?.occurredAt;
  const end =
    entry.status === "planned"
      ? Date.parse(entry.plan.expiresAt)
      : Date.parse(
          entry.closedAt ??
            (["expired", "cancelled"].includes(entry.status) ? (inactiveTime ?? entry.plan.expiresAt) : latestTime),
        );
  return { start, end: Math.max(start, end) };
}
export function journalChartStatus(entry: JournalRecord): JournalRecord["status"] {
  return entry.status;
}
export function MarketChartJournalLayer({
  entry,
  position,
  width,
  height,
  onSelect,
  marker,
  preview = false,
  showLabels = true,
}: {
  entry: JournalRecord;
  position: JournalPosition;
  width: number;
  height: number;
  onSelect?: (id: string) => void;
  marker?: PlacedChartMarker;
  preview?: boolean;
  showLabels?: boolean;
}) {
  const status = journalChartStatus(entry);
  const needsReview = entry.monitoringStatus?.startsWith("Needs review") ?? false;
  const active = (status === "planned" || status === "open") && !needsReview;
  const showLevels = status === "planned" || status === "open" || preview;
  const end = Math.max(position.x, Math.min(position.endX, width));
  const labelOnRight = width - end >= 140;
  const labelX = labelOnRight ? end + 6 : Math.max(0, end - 6);
  const target = position.targets.at(-1) ?? position.entry;
  const top = Math.max(0, Math.min(position.entry, target));
  const bottom = Math.min(height, Math.max(position.entry, target));
  const stopTop = Math.max(0, Math.min(position.entry, position.stop));
  const stopBottom = Math.min(height, Math.max(position.entry, position.stop));
  const levels = [
    { label: "Entry", y: position.entry, price: entry.entryPrice ?? entry.plan.entry },
    { label: "SL", y: position.stop, price: entry.plan.stopLoss },
    ...position.targets.map((y, index) => ({ label: `TP ${index + 1}`, y, price: entry.plan.targets[index] })),
  ];
  const labels = levels.filter((level) => level.y >= 0 && level.y <= height).sort((a, b) => a.y - b.y);
  let previous = -24;
  const positioned = labels.map((level, index) => {
    const labelY = Math.min(Math.max(level.y - 8, previous + 22), height - 20 - (labels.length - index - 1) * 22);
    previous = labelY;
    return { ...level, labelY };
  });
  return (
    <>
      {showLevels ? (
        <>
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
            width={width}
            height={height}
          >
            <rect
              x={position.x}
              y={top}
              width={end - position.x}
              height={Math.max(0, bottom - top)}
              className="fill-emerald-500/15"
            />
            <rect
              x={position.x}
              y={stopTop}
              width={end - position.x}
              height={Math.max(0, stopBottom - stopTop)}
              className="fill-rose-500/15"
            />
            {showLabels &&
              positioned.map((level) => (
                <line
                  key={`label:${level.label}`}
                  x1={end}
                  x2={labelX}
                  y1={level.y}
                  y2={level.labelY + 8}
                  className="stroke-muted-foreground/40"
                />
              ))}
            {levels.map((level) => (
              <line
                key={level.label}
                x1={position.x}
                x2={end}
                y1={level.y}
                y2={level.y}
                className={
                  level.label === "SL"
                    ? "stroke-rose-500"
                    : level.label === "Entry"
                      ? "stroke-foreground"
                      : "stroke-emerald-500"
                }
                strokeDasharray={level.label === "Entry" ? undefined : "4 4"}
              />
            ))}
          </svg>
          {showLabels &&
            positioned.map((level) => (
              <span
                key={level.label}
                className="pointer-events-none absolute whitespace-nowrap text-xs tabular-nums"
                style={{ left: labelX, top: level.labelY, transform: labelOnRight ? undefined : "translateX(-100%)" }}
              >
                {level.label} {chartPrice(level.price)}
                {needsReview && level.label === "Entry" ? " · Needs review" : ""}
              </span>
            ))}
        </>
      ) : null}
      {marker ? (
        <>
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
            width={width}
            height={height}
          >
            <line
              x1={position.x}
              y1={position.entry}
              x2={marker.left + marker.width / 2}
              y2={marker.top + marker.height / 2}
              className="stroke-muted-foreground"
              strokeDasharray="2 3"
            />
            <circle cx={position.x} cy={position.entry} r={3} className="fill-background stroke-muted-foreground" />
          </svg>
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant={active ? "secondary" : "outline"}
                    size="icon-xs"
                    className="absolute rounded-full shadow-sm"
                    style={{ left: marker.left, top: marker.top, width: marker.width }}
                    aria-label={`${entry.symbol} ${entry.plan.direction === "BUY" ? "Long" : "Short"} journal plan: ${status}`}
                    data-chart-trade={entry.id}
                  >
                    <BookOpen data-icon="inline-start" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent
                sideOffset={8}
                className="border bg-background/80 text-foreground shadow-sm backdrop-blur-md [&_.rotate-45]:hidden!"
              >
                {entry.plan.direction === "BUY" ? "Long" : "Short"} · {status}
                {needsReview ? " · Needs review" : ""}
              </TooltipContent>
            </Tooltip>
            <PopoverContent collisionPadding={16} className="w-80 max-w-[calc(100vw-2rem)]">
              <PopoverHeader>
                <PopoverTitle>
                  {entry.symbol} · {entry.plan.direction === "BUY" ? "Long" : "Short"}
                </PopoverTitle>
                <PopoverDescription>
                  {entry.resultBasis === "estimated"
                    ? "Estimated journal trade"
                    : entry.entryPrice !== null
                      ? "Recorded trade with planned levels"
                      : entry.source === "ai"
                        ? "Saved AI plan"
                        : "Waiting journal plan"}{" "}
                  · {entry.plan.interval}
                </PopoverDescription>
              </PopoverHeader>
              <Badge variant="outline">{status}</Badge>
              <ConditionalEntrySummary plan={entry.plan} entryPrice={entry.entryPrice} />
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {levels.map((level) => (
                  <div key={level.label}>
                    <dt className="text-muted-foreground text-xs">{level.label}</dt>
                    <dd className="tabular-nums">
                      {chartPrice(level.price)} {entry.plan.quote}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="text-muted-foreground text-xs">
                {entry.openedAt
                  ? `Entry recorded ${chartDate(entry.openedAt)}.`
                  : `Plan saved ${chartDate(entry.createdAt)}.`}{" "}
                {needsReview
                  ? "Automatic tracking is paused. Review the timeline before assuming a result."
                  : preview && !active
                    ? "Saved plan levels are shown for review. This does not reactivate the trade or confirm execution."
                    : active
                      ? entry.status === "planned"
                        ? `Shading runs from when the plan was saved until its expiry (${chartDate(entry.plan.expiresAt)}). It does not predict an exit time.`
                        : "Shading runs from the recorded entry to the latest available candle. It does not confirm an exit."
                      : "This plan is inactive. Only its saved entry marker remains on the chart."}
              </p>
              {onSelect ? (
                <Button size="sm" variant="outline" onClick={() => onSelect(entry.id)}>
                  Journal details
                </Button>
              ) : null}
            </PopoverContent>
          </Popover>
        </>
      ) : null}
    </>
  );
}
