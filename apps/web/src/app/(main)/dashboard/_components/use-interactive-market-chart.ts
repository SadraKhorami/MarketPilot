"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

import type { JournalRecord } from "@marketpilot/ai/contracts";
import type { MarketCandle, MarketObservation } from "@marketpilot/market-data";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  HistogramSeries,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  LineSeries,
  LineStyle,
  type Logical,
  TickMarkType,
  type Time,
} from "lightweight-charts";

import type { AlertRecord } from "../alerts/_components/alert-types";
import type { JournalPosition } from "./market-chart-journal-layer";
import { canvasColor, chartDate, chartPrice, chartTime, pricePrecision, timePosition } from "./market-chart-utils";

export type MarketChartView = "line" | "candles" | "volume";
export type AlertPosition = { id: string; x: number | null; y: number; startsBeforeWindow: boolean };
export type CandleInspection = { candle: MarketCandle; x: number; y: number };
interface ChartRuntime {
  chart: IChartApi;
  line: ISeriesApi<"Line">;
  candles: ISeriesApi<"Candlestick">;
  average: ISeriesApi<"Line">;
  volume: ISeriesApi<"Histogram">;
  selectedLine: { line: IPriceLine; owner: ISeriesApi<"Line"> | ISeriesApi<"Candlestick"> } | null;
  schedule: () => void;
}

export function useInteractiveMarketChart({
  data,
  view,
  alerts,
  selectedId,
  onAlert,
  onInspect,
  journal,
  showAverage,
}: {
  journal?: JournalRecord;
  showAverage: boolean;
  data: MarketObservation;
  view: MarketChartView;
  alerts: AlertRecord[];
  selectedId: string | null;
  onAlert: (id: string, point?: { x: number; y: number }) => void;
  onInspect: (inspection: CandleInspection) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const runtime = useRef<ChartRuntime | null>(null);
  const previousCandles = useRef<MarketCandle[]>([]);
  const [geometry, setGeometry] = useState<{
    positions: AlertPosition[];
    journalPosition: JournalPosition | null;
    width: number;
    height: number;
  }>({
    positions: [],
    journalPosition: null,
    width: 0,
    height: 0,
  });
  const [hovered, setHovered] = useState<MarketCandle | null>(null);

  const updateGeometry = useEffectEvent(() => {
    const current = runtime.current;
    if (!current || !container.current) return;
    const series = view === "candles" ? current.candles : current.line;
    const width = current.chart.timeScale().width();
    const height = container.current.clientHeight - current.chart.timeScale().height();
    const positions =
      view === "volume"
        ? []
        : alerts
            .filter((rule) => rule.condition.startsWith("PRICE_"))
            .flatMap((rule) => {
              const y = series.priceToCoordinate(Number(rule.threshold));
              if (y === null || y < 0 || y > height) return [];
              const placement = timePosition(data.candles, Date.parse(rule.createdAt));
              // The library maps integer bar indices; interpolate pixels for the exact creation time.
              const beforeX =
                placement === null
                  ? null
                  : current.chart.timeScale().logicalToCoordinate(Math.floor(placement) as Logical);
              const afterX =
                placement === null
                  ? null
                  : current.chart.timeScale().logicalToCoordinate(Math.ceil(placement) as Logical);
              const x =
                placement === null || beforeX === null || afterX === null
                  ? null
                  : beforeX + (afterX - beforeX) * (placement - Math.floor(placement));
              return [
                {
                  id: rule.id,
                  x,
                  y,
                  startsBeforeWindow: Date.parse(rule.createdAt) < Date.parse(data.candles[0].time),
                },
              ];
            });
    let journalPosition: JournalPosition | null = null;
    if (journal && view !== "volume") {
      const timestamp = Date.parse(journal.openedAt ?? journal.createdAt);
      const lastTime = Date.parse(data.candles.at(-1)!.time);
      const barDuration = data.candles.length > 1 ? lastTime - Date.parse(data.candles.at(-2)!.time) : 60_000;
      const logical =
        timestamp > lastTime
          ? data.candles.length - 1 + (timestamp - lastTime) / barDuration
          : timePosition(data.candles, timestamp);
      const x =
        logical === null
          ? Date.parse(journal.openedAt ?? journal.createdAt) < Date.parse(data.candles[0].time)
            ? 0
            : null
          : (() => {
              const before = current.chart.timeScale().logicalToCoordinate(Math.floor(logical) as Logical);
              const after = current.chart.timeScale().logicalToCoordinate(Math.ceil(logical) as Logical);
              return before === null || after === null
                ? null
                : before + (after - before) * (logical - Math.floor(logical));
            })();
      const entry = series.priceToCoordinate(journal.entryPrice ?? journal.plan.entry);
      const stop = series.priceToCoordinate(journal.plan.stopLoss);
      const targets = journal.plan.targets.map((price) => series.priceToCoordinate(price));
      if (x !== null && x < width && entry !== null && stop !== null && targets.every((y) => y !== null))
        journalPosition = {
          id: journal.id,
          x: Math.max(0, x),
          entry,
          stop,
          targets: targets.filter((y): y is NonNullable<typeof y> => y !== null),
        };
    }
    const selected = positions.find((position) => position.id === selectedId);
    if (current.selectedLine && current.selectedLine.line.options().axisLabelVisible !== Boolean(selected)) {
      current.selectedLine.line.applyOptions({ axisLabelVisible: Boolean(selected) });
    }
    setGeometry((previous) =>
      JSON.stringify(previous.journalPosition) === JSON.stringify(journalPosition) &&
      previous.width === width &&
      previous.height === height &&
      previous.positions.length === positions.length &&
      positions.every((position, index) => {
        const old = previous.positions[index];
        return (
          old.id === position.id &&
          old.x === position.x &&
          old.y === position.y &&
          old.startsBeforeWindow === position.startsBeforeWindow
        );
      })
        ? previous
        : { positions, journalPosition, width, height },
    );
  });
  const clickAlert = useEffectEvent((x: number, y: number) => {
    const matches = geometry.positions.filter((position) => Math.abs(position.y - y) < 9 && x <= geometry.width);
    if (matches.length) onAlert(matches.sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y))[0].id, { x, y });
  });
  const inspectCandle = useEffectEvent((time: Time | undefined, x: number, y: number, pin: boolean) => {
    const candle = data.candles.find((item) => chartTime(item.time) === time);
    setHovered(candle ?? null);
    if (pin && candle) onInspect({ candle, x, y });
  });

  const getPrecision = useEffectEvent(() => pricePrecision(data.price));

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const colors = {
      background: canvasColor(element, "--card"),
      text: canvasColor(element, "--muted-foreground"),
      grid: canvasColor(element, "--border"),
      up: canvasColor(element, "--color-emerald-500"),
      down: canvasColor(element, "--color-rose-500"),
      average: canvasColor(element, "--color-violet-500"),
    };
    const chart = createChart(element, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.text,
        fontFamily: getComputedStyle(element).fontFamily,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: colors.grid, style: LineStyle.Dotted } },
      rightPriceScale: { borderVisible: false, minimumWidth: 80, scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        minBarSpacing: 1,
        tickMarkFormatter: (time: Time, type: TickMarkType) =>
          typeof time === "number"
            ? new Date(time * 1000).toLocaleString(
                undefined,
                type === TickMarkType.Time || type === TickMarkType.TimeWithSeconds
                  ? { hour: "2-digit", minute: "2-digit" }
                  : { month: "short", day: "numeric" },
              )
            : null,
      },
      localization: { timeFormatter: (time: Time) => (typeof time === "number" ? chartDate(time) : String(time)) },
      crosshair: { mode: CrosshairMode.Normal },
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true, axisDoubleClickReset: true },
    });
    const precision = getPrecision();
    const priceFormat = { type: "price" as const, precision, minMove: 10 ** -precision };
    const line = chart.addSeries(LineSeries, {
      color: colors.up,
      lineWidth: 2,
      priceFormat,
      lastValueVisible: true,
      priceLineVisible: false,
    });
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: colors.up,
      downColor: colors.down,
      wickUpColor: colors.up,
      wickDownColor: colors.down,
      borderVisible: false,
      priceFormat,
      visible: false,
      priceLineVisible: false,
    });
    const average = chart.addSeries(LineSeries, {
      color: colors.average,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceFormat,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    const volume = chart.addSeries(HistogramSeries, {
      priceScaleId: "right",
      priceFormat: { type: "volume" },
      visible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      color: colors.up,
    });
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        updateGeometry();
      });
    };
    runtime.current = { chart, line, candles, average, volume, selectedLine: null, schedule };
    previousCandles.current = [];
    chart.subscribeCrosshairMove((event) => {
      inspectCandle(event.time, event.point?.x ?? 0, event.point?.y ?? 0, false);
      schedule();
    });
    chart.subscribeClick((event) => {
      if (event.point) clickAlert(event.point.x, event.point.y);
    });
    chart.subscribeDblClick((event) => {
      if (event.point) inspectCandle(event.time, event.point.x, event.point.y, true);
    });
    chart.timeScale().subscribeVisibleLogicalRangeChange(schedule);
    chart.timeScale().subscribeSizeChange(schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    const syncTheme = () => {
      chart.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: canvasColor(element, "--card") },
          textColor: canvasColor(element, "--muted-foreground"),
        },
        grid: { horzLines: { color: canvasColor(element, "--border") } },
      });
    };
    const themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme-preset"],
    });
    const themeFrame = requestAnimationFrame(syncTheme);
    element.addEventListener("pointermove", schedule);
    element.addEventListener("wheel", schedule);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(themeFrame);
      observer.disconnect();
      themeObserver.disconnect();
      element.removeEventListener("pointermove", schedule);
      element.removeEventListener("wheel", schedule);
      chart.remove();
      runtime.current = null;
    };
  }, []);

  useEffect(() => {
    const current = runtime.current;
    if (!current) return;
    const { chart, line, candles, average, volume } = current;
    const old = previousCandles.current;
    const range = chart.timeScale().getVisibleRange();
    const logical = chart.timeScale().getVisibleLogicalRange();
    const followLatest = !old.length || !logical || logical.to >= old.length - 1;
    const values = data.candles.map((candle) => ({ ...candle, time: chartTime(candle.time) }));
    // Rolling provider windows can correct older candles, so replace the snapshot while preserving the user's time window.
    line.setData(values.map((candle) => ({ time: candle.time, value: candle.close })));
    candles.setData(values);
    average.setData(
      values.flatMap((candle, index) =>
        index < 49
          ? []
          : [
              {
                time: candle.time,
                value: values.slice(index - 49, index + 1).reduce((total, item) => total + item.close, 0) / 50,
              },
            ],
      ),
    );
    volume.setData(values.map((candle) => ({ time: candle.time, value: candle.volume ?? 0 })));
    if (!old.length) chart.timeScale().fitContent();
    else if (!followLatest && range) chart.timeScale().setVisibleRange(range);
    else chart.timeScale().scrollToRealTime();
    previousCandles.current = data.candles;
    current.schedule();
  }, [data]);

  useEffect(() => {
    const current = runtime.current;
    if (!current) return;
    current.line.applyOptions({ visible: view === "line" });
    current.candles.applyOptions({ visible: view === "candles" });
    current.average.applyOptions({ visible: view !== "volume" && showAverage });
    current.volume.applyOptions({ visible: view === "volume" });
    current.chart.priceScale("right").setAutoScale(true);
    current.chart.applyOptions({
      localization: {
        priceFormatter:
          view === "volume"
            ? (value: number) => value.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 1 })
            : chartPrice,
      },
    });
    current.schedule();
  }, [view, showAverage]);

  useEffect(() => {
    const current = runtime.current;
    const element = container.current;
    if (!current || !element) return;
    if (current.selectedLine) {
      current.selectedLine.owner.removePriceLine(current.selectedLine.line);
      current.selectedLine = null;
    }
    const rule = alerts.find((item) => item.id === selectedId);
    if (rule && view !== "volume" && rule.condition.startsWith("PRICE_")) {
      const series = view === "candles" ? current.candles : current.line;
      current.selectedLine = {
        owner: series,
        line: series.createPriceLine({
          price: Number(rule.threshold),
          color: canvasColor(element, "--color-amber-500"),
          lineVisible: false,
          axisLabelVisible: true,
          title: "",
          lineWidth: 1,
        }),
      };
    }
    current.schedule();
  }, [alerts, selectedId, view]);

  useEffect(() => {
    runtime.current?.schedule();
    if (!journal && !alerts.length) {
      setGeometry((previous) =>
        previous.positions.length || previous.journalPosition
          ? { ...previous, positions: [], journalPosition: null }
          : previous,
      );
    }
  }, [journal, alerts]);

  const focusJournal = () => {
    const current = runtime.current;
    if (!current || !journal) return;
    const prices = [
      journal.entryPrice ?? journal.plan.entry,
      journal.plan.stopLoss,
      ...journal.plan.targets,
      data.price,
    ];
    const low = Math.min(...prices);
    const high = Math.max(...prices);
    const padding = Math.max((high - low) * 0.15, high * 0.0001);
    current.chart.priceScale("right").setVisibleRange({ from: low - padding, to: high + padding });
    const timestamp = Date.parse(journal.openedAt ?? journal.createdAt);
    const lastTime = Date.parse(data.candles.at(-1)!.time);
    const barDuration = data.candles.length > 1 ? lastTime - Date.parse(data.candles.at(-2)!.time) : 60_000;
    const center =
      timePosition(data.candles, timestamp) ??
      data.candles.length - 1 + Math.max(0, timestamp - lastTime) / barDuration;
    current.chart.timeScale().setVisibleLogicalRange({ from: center - 30, to: center + 15 });
    current.schedule();
  };

  const zoom = (factor: number) => {
    const chart = runtime.current?.chart;
    const range = chart?.timeScale().getVisibleLogicalRange();
    if (!chart || !range) return;
    const center = (range.from + range.to) / 2;
    const half = Math.max(5, ((range.to - range.from) * factor) / 2);
    chart.timeScale().setVisibleLogicalRange({ from: center - half, to: center + half });
  };
  const reset = () => {
    runtime.current?.chart.priceScale("right").setAutoScale(true);
    runtime.current?.chart.timeScale().fitContent();
    runtime.current?.schedule();
  };
  const focusAlert = (rule: AlertRecord) => {
    const current = runtime.current;
    if (!current) return;
    const price = Number(rule.threshold);
    const range = current.chart.priceScale("right").getVisibleRange();
    if (range && (price < range.from || price > range.to)) {
      const low = Math.min(range.from, price);
      const high = Math.max(range.to, price);
      const padding = Math.max((high - low) * 0.12, price * 0.0001);
      current.chart.priceScale("right").setVisibleRange({ from: low - padding, to: high + padding });
    }
    const logical = timePosition(data.candles, Date.parse(rule.createdAt));
    const visible = current.chart.timeScale().getVisibleLogicalRange();
    if (logical !== null && visible && (logical < visible.from || logical > visible.to)) {
      const span = visible.to - visible.from;
      current.chart.timeScale().setVisibleLogicalRange({ from: logical - span / 2, to: logical + span / 2 });
    }
    current.schedule();
  };
  return { container, geometry, hovered, zoom, reset, focusAlert, focusJournal };
}
