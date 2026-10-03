import type { MarketObservation } from "@marketpilot/market-data";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
} from "@/components/ui/popover";

import type { AlertRecord } from "../alerts/_components/alert-types";
import { conditionLabel } from "../alerts/_components/alert-types";
import { chartDate, chartPrice } from "./market-chart-utils";
import type { CandleInspection } from "./use-interactive-market-chart";

export type ChartInspection =
  | { kind: "alert"; id: string; x?: number; y?: number }
  | ({ kind: "candle" } & CandleInspection);
export function MarketChartInspection({
  inspection,
  inspected,
  data,
  anchorX,
  anchorY,
  geometry,
  onClose,
  onReturnFocus,
  onAlertSelect,
}: {
  inspection: ChartInspection | null;
  inspected: AlertRecord | null | undefined;
  data: MarketObservation;
  anchorX: number;
  anchorY: number;
  geometry: { width: number; height: number };
  onClose: () => void;
  onReturnFocus: () => void;
  onAlertSelect?: (id: string) => void;
}) {
  const quote = data.symbol.split("-").at(-1) ?? "USD";
  return (
    <Popover
      open={inspection !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <PopoverAnchor asChild>
        <span
          className="pointer-events-none absolute size-px"
          style={{
            left: Math.min(Math.max(anchorX, 0), geometry.width),
            top: Math.min(Math.max(anchorY, 0), geometry.height),
          }}
        />
      </PopoverAnchor>
      <PopoverContent
        collisionPadding={16}
        side="top"
        className="w-80 max-w-[calc(100vw-2rem)]"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
      >
        {inspected ? (
          <>
            <PopoverHeader>
              <PopoverTitle>{inspected.name}</PopoverTitle>
              <PopoverDescription>{conditionLabel(inspected)}</PopoverDescription>
            </PopoverHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{inspected.enabled ? "Active" : "Paused"}</Badge>
              <span className="text-muted-foreground text-xs">{inspected.interval} candles</span>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
              <dt className="text-muted-foreground">Created</dt>
              <dd className="text-right">{chartDate(inspected.createdAt)}</dd>
              <dt className="text-muted-foreground">Last triggered</dt>
              <dd className="text-right">
                {inspected.lastTriggeredAt ? chartDate(inspected.lastTriggeredAt) : "Not yet"}
              </dd>
            </dl>
            <p className="text-muted-foreground text-xs">
              The dashed line marks your alert price.
              {Date.parse(inspected.createdAt) > Date.parse(data.candles.at(-1)!.time)
                ? " Its creation time is after the latest candle, so the bell appears at the right edge until that time is covered."
                : Date.parse(inspected.createdAt) < Date.parse(data.candles[0].time)
                  ? " Its creation time is before the available history, so the bell appears at the left edge."
                  : " The bell marks its creation time; a connector keeps its exact location clear when nearby badges are separated."}
            </p>
            {onAlertSelect ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onAlertSelect(inspected.id);
                }}
              >
                Full details & history
              </Button>
            ) : null}
          </>
        ) : inspection?.kind === "candle" ? (
          <>
            <PopoverHeader>
              <PopoverTitle>
                {data.symbol} · {data.interval}
              </PopoverTitle>
              <PopoverDescription>{chartDate(inspection.candle.time)}</PopoverDescription>
            </PopoverHeader>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              {[
                ["Open", inspection.candle.open],
                ["High", inspection.candle.high],
                ["Low", inspection.candle.low],
                ["Close", inspection.candle.close],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="tabular-nums">{chartPrice(Number(value))}</dd>
                </div>
              ))}
            </dl>
            <p className="text-muted-foreground text-xs">
              {quote} ·{" "}
              {inspection.candle.volume === null
                ? "Volume not supplied"
                : `Volume ${inspection.candle.volume.toLocaleString()}`}
            </p>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
