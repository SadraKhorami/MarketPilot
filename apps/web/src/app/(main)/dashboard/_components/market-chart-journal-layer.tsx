"use client";
import type { JournalRecord } from "@marketpilot/ai/contracts";
import { BookOpen } from "lucide-react";

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
  const end = entry.status === "planned" ? Date.parse(entry.plan.expiresAt) : Date.parse(entry.closedAt ?? latestTime);
  return { start, end: Math.max(start, end) };
}
export function journalChartStatus(entry: JournalRecord): JournalRecord["status"] {
  return entry.status === "planned" && Date.parse(entry.plan.expiresAt) <= Date.now() ? "expired" : entry.status;
}
export function MarketChartJournalLayer({
  entry,
  position,
  width,
  height,
  onSelect,
  marker,
}: {
  entry: JournalRecord;
  position: JournalPosition;
  width: number;
  height: number;
  onSelect?: (id: string) => void;
  marker?: PlacedChartMarker;
}) {
  const status = journalChartStatus(entry);
  const active = status === "planned" || status === "open";
  const end = Math.max(position.x, Math.min(position.endX, width));
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
      {active ? (
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
            {positioned.map((level) => (
              <line
                key={`label:${level.label}`}
                x1={end}
                x2={Math.max(0, end - 140)}
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
          {positioned.map((level) => (
            <span
              key={level.label}
              className="pointer-events-none absolute whitespace-nowrap rounded-sm bg-background/90 px-1.5 text-xs tabular-nums"
              style={{ left: Math.max(0, end - 140), top: level.labelY }}
            >
              {level.label} {chartPrice(level.price)}
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
            <PopoverTrigger asChild>
              <Button
                variant={active ? "secondary" : "outline"}
                size="icon-xs"
                className="absolute rounded-full shadow-sm"
                style={{ left: marker.left, top: marker.top, width: marker.width }}
                aria-label={`${entry.symbol} ${entry.plan.direction === "BUY" ? "Long" : "Short"} journal plan: ${status}`}
                title={`${entry.plan.direction === "BUY" ? "Long" : "Short"} · ${status} — Journal details`}
              >
                <BookOpen data-icon="inline-start" />
              </Button>
            </PopoverTrigger>
            <PopoverContent collisionPadding={16} className="w-80 max-w-[calc(100vw-2rem)]">
              <PopoverHeader>
                <PopoverTitle>
                  {entry.symbol} · {entry.plan.direction === "BUY" ? "Long" : "Short"}
                </PopoverTitle>
                <PopoverDescription>
                  {entry.entryPrice !== null ? "Recorded entry with planned levels" : "Saved journal plan"} ·{" "}
                  {entry.plan.interval}
                </PopoverDescription>
              </PopoverHeader>
              <Badge variant="outline">{status}</Badge>
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
                {active
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
