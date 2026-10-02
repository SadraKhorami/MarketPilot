"use client";

import { type ReactNode, useId, useState } from "react";

import type { JournalRecord } from "@marketpilot/ai/contracts";
import type { MarketObservation } from "@marketpilot/market-data";
import { cn } from "cn";
import { ArrowDown, ArrowUp, Bell, Info, Layers, Minus, Plus, Scan, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { AlertRecord } from "../alerts/_components/alert-types";
import { conditionLabel } from "../alerts/_components/alert-types";
import { MarketChartAlertLayer } from "./market-chart-alert-layer";
import { type ChartInspection, MarketChartInspection } from "./market-chart-inspection";
import { MarketChartJournalLayer } from "./market-chart-journal-layer";
import { chartDate, chartPrice } from "./market-chart-utils";
import { useAccountPreference } from "./use-account-preference";
import { type MarketChartView, useInteractiveMarketChart } from "./use-interactive-market-chart";

const defaultLayers = { alerts: true, journal: true, average: true };
function validLayers(value: unknown): value is typeof defaultLayers {
  return (
    typeof value === "object" &&
    value !== null &&
    "alerts" in value &&
    typeof value.alerts === "boolean" &&
    "journal" in value &&
    typeof value.journal === "boolean" &&
    "average" in value &&
    typeof value.average === "boolean"
  );
}

export function InteractiveMarketChart({
  data,
  alerts,
  onAlertSelect,
  compact = false,
  journal = [],
  onJournalSelect,
}: {
  data: MarketObservation;
  alerts: AlertRecord[];
  onAlertSelect?: (id: string) => void;
  compact?: boolean;
  journal?: JournalRecord[];
  onJournalSelect?: (id: string) => void;
}) {
  const layerControlId = useId();
  const layers = useAccountPreference("chart-layers", defaultLayers, validLayers);
  const [journalId, setJournalId] = useState<string | null>(null);
  const activeJournal =
    journal.find((item) => item.id === journalId) ??
    journal.find((item) => item.status === "open" || item.status === "planned") ??
    journal[0];
  const [view, setView] = useState<MarketChartView>("line");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspection, setInspection] = useState<ChartInspection | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const activeId = selectedId ?? alerts.find((rule) => rule.condition.startsWith("PRICE_") && rule.enabled)?.id ?? null;
  const selected = alerts.find((rule) => rule.id === activeId);
  const inspected = inspection?.kind === "alert" ? alerts.find((rule) => rule.id === inspection.id) : null;
  const quote = data.symbol.split("-").at(-1) ?? "USD";
  const hasVolume = data.candles.every((candle) => candle.volume !== null);
  const { container, geometry, hovered, zoom, reset, focusAlert, focusJournal } = useInteractiveMarketChart({
    data,
    view,
    alerts: layers.value.alerts ? alerts : [],
    journal: layers.value.journal ? activeJournal : undefined,
    showAverage: layers.value.average,
    selectedId: activeId,
    onAlert: (id, point) => {
      setSelectedId(id);
      setInspection({ kind: "alert", id, ...point });
    },
    onInspect: (details) => setInspection({ kind: "candle", ...details }),
  });
  const candle = hovered ?? data.candles.at(-1);
  const showAlert = (rule: AlertRecord) => {
    if (!layers.value.alerts) layers.update({ ...layers.value, alerts: true });
    if (view === "volume") setView("line");
    setSelectedId(rule.id);
    if (rule.condition.startsWith("PRICE_")) {
      if (view === "volume") requestAnimationFrame(() => focusAlert(rule));
      else focusAlert(rule);
    }
    setInspection({ kind: "alert", id: rule.id });
  };
  const showJournal = () => {
    layers.update({ ...layers.value, journal: true });
    if (view === "volume") {
      setView("line");
      requestAnimationFrame(focusJournal);
    } else focusJournal();
  };
  const selectedPosition = geometry.positions.find((position) => position.id === activeId);
  const anchorX = inspection?.x ?? selectedPosition?.x ?? geometry.width / 2;
  const anchorY = inspection?.y ?? selectedPosition?.y ?? geometry.height / 2;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup
            type="single"
            value={view}
            variant="outline"
            spacing={0}
            size="sm"
            aria-label="Chart display"
            onValueChange={(value) => {
              if (value === "line" || value === "candles" || value === "volume") {
                setView(value);
                setInspection(null);
              }
            }}
          >
            <ToggleGroupItem value="line">Line</ToggleGroupItem>
            <ToggleGroupItem value="candles">Candles</ToggleGroupItem>
            <ToggleGroupItem value="volume" disabled={!hasVolume}>
              Volume
            </ToggleGroupItem>
          </ToggleGroup>
          {view !== "volume" && layers.value.average ? (
            <span className="hidden items-center gap-2 text-muted-foreground text-xs sm:flex">
              <span className="h-0.5 w-3 bg-violet-500" />
              SMA 50
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {activeJournal ? (
            <Button variant="outline" size="sm" onClick={showJournal} aria-label="Focus saved journal position">
              <Scan data-icon="inline-start" /> Position
            </Button>
          ) : null}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Chart layers">
                <Layers />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" collisionPadding={16} className="w-72">
              <PopoverHeader>
                <PopoverTitle>Chart layers</PopoverTitle>
                <PopoverDescription>Choose what appears on the chart.</PopoverDescription>
              </PopoverHeader>
              {(["alerts", "journal", "average"] as const).map((key) => (
                <label key={key} htmlFor={`${layerControlId}-${key}`} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id={`${layerControlId}-${key}`}
                    checked={layers.value[key]}
                    onCheckedChange={(checked) => layers.update({ ...layers.value, [key]: checked === true })}
                  />
                  {key === "alerts" ? "My alerts" : key === "journal" ? "Journal position" : "Moving average"}
                </label>
              ))}
              {journal.length ? (
                <>
                  <Select value={activeJournal?.id} onValueChange={setJournalId}>
                    <SelectTrigger className="w-full" aria-label="Visible journal position">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {journal.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.plan.direction === "BUY" ? "Long" : "Short"} · {item.status} ·{" "}
                            {chartDate(item.createdAt)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={showJournal}>
                    Fit position levels
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground text-xs">No journal plans for this market yet.</p>
              )}
            </PopoverContent>
          </Popover>
          <ChartControl label="Zoom out" onClick={() => zoom(1.4)}>
            <Minus />
          </ChartControl>
          <ChartControl label="Zoom in" onClick={() => zoom(0.7)}>
            <Plus />
          </ChartControl>
          <ChartControl label="Fit all available history" onClick={reset}>
            <Scan />
          </ChartControl>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="How to use this chart">
                <Info />
              </Button>
            </PopoverTrigger>
            <PopoverContent collisionPadding={16} align="end" className="w-72">
              <PopoverHeader>
                <PopoverTitle>Explore the chart</PopoverTitle>
                <PopoverDescription>
                  Drag to move through time. Scroll or pinch to zoom. Drag the right price scale to adjust the vertical
                  view.
                </PopoverDescription>
              </PopoverHeader>
              <p className="text-muted-foreground text-xs">
                Double-click a candle for its values. Click an alert line or bell for details. Fit restores the full
                window.
              </p>
              <p className="text-muted-foreground text-xs">
                The bell marks the alert’s creation time at its configured price. Dashed levels are not past triggers.
                Times use your local timezone.
              </p>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <section
        className="flex min-h-10 flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums"
        aria-label="Candle values"
      >
        <span className="text-muted-foreground">{candle ? chartDate(candle.time) : "—"}</span>
        {candle && view !== "volume"
          ? (
              [
                ["O", candle.open],
                ["H", candle.high],
                ["L", candle.low],
                ["C", candle.close],
              ] as const
            ).map(([label, value]) => (
              <span key={label}>
                <span className="mr-1 text-muted-foreground">{label}</span>
                {chartPrice(value)}
              </span>
            ))
          : null}
        {view === "volume" ? (
          <span>
            Volume {candle?.volume?.toLocaleString() ?? "—"} {data.symbol.split("-")[0]}
          </span>
        ) : (
          <span className="text-muted-foreground">{quote}</span>
        )}
      </section>
      <div className="relative isolate">
        <div
          ref={container}
          className={cn("isolate w-full outline-none", compact ? "h-64 sm:h-72" : "h-80 sm:h-96")}
          tabIndex={-1}
          role="img"
          aria-label={`${data.symbol} interactive ${view} chart. Use the zoom controls or drag the chart. Alerts are also listed below.`}
        />
        {view !== "volume" && layers.value.alerts ? (
          <MarketChartAlertLayer
            alerts={alerts}
            geometry={geometry}
            activeId={activeId}
            highlightedId={highlightedId}
            onHighlight={setHighlightedId}
            onSelect={showAlert}
          />
        ) : null}
        {view !== "volume" && layers.value.journal && activeJournal && geometry.journalPosition ? (
          <MarketChartJournalLayer
            entry={activeJournal}
            position={geometry.journalPosition}
            width={geometry.width}
            height={geometry.height}
            onSelect={onJournalSelect}
          />
        ) : null}
        <MarketChartInspection
          inspection={inspection}
          inspected={inspected}
          data={data}
          anchorX={anchorX}
          anchorY={anchorY}
          geometry={geometry}
          onClose={() => setInspection(null)}
          onReturnFocus={() => container.current?.focus({ preventScroll: true })}
          onAlertSelect={onAlertSelect}
        />
      </div>
      {alerts.length ? (
        <section className="flex flex-wrap items-center gap-2" aria-label="Alerts for this market">
          <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Bell className="size-3.5" />
            Your alerts
          </span>
          {alerts.map((rule) => {
            const Direction = rule.condition === "PRICE_ABOVE" ? ArrowUp : ArrowDown;
            return (
              <Button
                key={rule.id}
                size="sm"
                variant={activeId === rule.id ? "secondary" : "outline"}
                aria-pressed={activeId === rule.id}
                aria-label={`Locate ${rule.name}: ${conditionLabel(rule)}`}
                onClick={() => showAlert(rule)}
              >
                {rule.condition.startsWith("PRICE_") ? (
                  <>
                    <Direction data-icon="inline-start" />
                    <span className="tabular-nums">{chartPrice(Number(rule.threshold))}</span>
                  </>
                ) : (
                  conditionLabel(rule)
                )}
                {!rule.enabled ? <span className="text-muted-foreground">Paused</span> : null}
              </Button>
            );
          })}
          {selected ? (
            <ChartControl
              label="Clear selected alert"
              onClick={() => {
                setSelectedId("");
                setInspection(null);
              }}
            >
              <X />
            </ChartControl>
          ) : null}
        </section>
      ) : null}
      {selected ? (
        <p className="text-muted-foreground text-xs">
          Selected: {conditionLabel(selected)} · Created {chartDate(selected.createdAt)}
          {view !== "volume" &&
          selected.condition.startsWith("PRICE_") &&
          (!selectedPosition ||
            (selectedPosition.x !== null && (selectedPosition.x < 0 || selectedPosition.x > geometry.width)))
            ? " · Outside this view; select the alert to locate it"
            : ""}
          {Date.parse(selected.createdAt) < Date.parse(data.candles[0].time)
            ? " · Before the available history"
            : Date.parse(selected.createdAt) > Date.parse(data.candles.at(-1)!.time)
              ? " · After the latest available candle"
              : ""}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground text-xs">
        <span>Drag to move · Scroll to zoom · Double-click for values</span>
        <a
          href="https://www.tradingview.com/"
          target="_blank"
          rel="noreferrer"
          title="Copyright (с) 2025 TradingView, Inc."
          className="hover:text-foreground"
        >
          TradingView Lightweight Charts™
        </a>
      </div>
    </div>
  );
}
function ChartControl({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={label} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
