import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { AlertRecord } from "../alerts/_components/alert-types";
import { conditionLabel } from "../alerts/_components/alert-types";
import { chartDate } from "./market-chart-utils";
import type { AlertPosition } from "./use-interactive-market-chart";

export function MarketChartAlertLayer({
  alerts,
  geometry,
  activeId,
  highlightedId,
  onHighlight,
  onSelect,
}: {
  alerts: AlertRecord[];
  geometry: { positions: AlertPosition[]; width: number; height: number };
  activeId: string | null;
  highlightedId: string | null;
  onHighlight: (id: string | null) => void;
  onSelect: (rule: AlertRecord) => void;
}) {
  const selected = alerts.find((rule) => rule.id === activeId);
  const selectedPosition = geometry.positions.find((position) => position.id === activeId);
  return (
    <>
      <svg className="pointer-events-none absolute inset-0 size-full overflow-hidden" aria-hidden="true">
        {geometry.positions.map((position) => {
          const focused = position.id === activeId || position.id === highlightedId;
          const startsAt = Math.max(0, position.x ?? 0);
          const rule = alerts.find((item) => item.id === position.id);
          if (!rule) return null;
          return (
            <g key={position.id}>
              <line
                x1={0}
                x2={geometry.width}
                y1={position.y}
                y2={position.y}
                stroke="var(--color-amber-500)"
                strokeWidth={1}
                strokeOpacity={focused ? 0.5 : 0.2}
                strokeDasharray="5 4"
              />
              <line
                x1={
                  position.x === null && !position.startsBeforeWindow
                    ? geometry.width
                    : Math.min(startsAt, geometry.width)
                }
                x2={geometry.width}
                y1={position.y}
                y2={position.y}
                stroke="var(--color-amber-500)"
                strokeWidth={focused ? 2 : 1}
                strokeOpacity={focused ? 1 : rule.enabled ? 0.55 : 0.25}
                strokeDasharray="5 4"
              />
              {position.x !== null && position.x >= 0 ? (
                <circle
                  cx={position.x}
                  cy={position.y}
                  r={focused ? 5 : 3}
                  fill="var(--card)"
                  stroke="var(--color-amber-500)"
                  strokeWidth={2}
                />
              ) : null}
              {focused && position.x !== null && position.x >= 0 ? (
                <line
                  x1={position.x}
                  x2={position.x}
                  y1={position.y}
                  y2={geometry.height}
                  stroke="var(--color-amber-500)"
                  strokeOpacity={0.45}
                  strokeDasharray="3 4"
                />
              ) : null}
            </g>
          );
        })}
        {selected &&
        selectedPosition?.x !== null &&
        selectedPosition?.x !== undefined &&
        selectedPosition.x >= 0 &&
        selectedPosition.x <= geometry.width ? (
          <g>
            <rect
              x={Math.min(Math.max(selectedPosition.x - 66, 0), Math.max(0, geometry.width - 132))}
              y={geometry.height + 2}
              width={132}
              height={20}
              rx={4}
              className="fill-amber-500"
            />
            <text
              x={Math.min(Math.max(selectedPosition.x, 66), Math.max(66, geometry.width - 66))}
              y={geometry.height + 16}
              textAnchor="middle"
              fontSize={11}
              className="fill-slate-950"
            >
              {chartDate(selected.createdAt)}
            </text>
          </g>
        ) : null}
      </svg>
      {geometry.positions
        .filter(
          (position) =>
            position.id === activeId && position.x !== null && position.x >= 0 && position.x <= geometry.width,
        )
        .map((position) => {
          const rule = alerts.find((item) => item.id === position.id);
          if (!rule) return null;
          return (
            <Tooltip key={position.id}>
              <TooltipTrigger asChild>
                <Button
                  variant={activeId === rule.id ? "default" : "outline"}
                  size="icon-xs"
                  className="absolute rounded-full shadow-sm"
                  style={{ left: position.x! - 12, top: position.y - 12 }}
                  aria-label={`Inspect ${rule.name}: ${conditionLabel(rule)}, created ${chartDate(rule.createdAt)}`}
                  onClick={() => onSelect(rule)}
                  onMouseEnter={() => onHighlight(rule.id)}
                  onMouseLeave={() => onHighlight(null)}
                >
                  <Bell />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {conditionLabel(rule)} · Created {chartDate(rule.createdAt)}
              </TooltipContent>
            </Tooltip>
          );
        })}
    </>
  );
}
