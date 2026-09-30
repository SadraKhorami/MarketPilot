"use client";

import type { MarketObservation } from "@marketpilot/market-data";
import { Label, Pie, PieChart } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";

export function MomentumPanel({ data }: { data: MarketObservation }) {
  const rsi = data.indicators.rsi;
  let label = "Neutral range";
  if (rsi === null) label = "Not enough data";
  else if (rsi >= 70) label = "Overbought range";
  else if (rsi <= 30) label = "Oversold range";
  const points =
    rsi === null
      ? []
      : [
          { name: "RSI", value: rsi, fill: "var(--color-emerald-500)" },
          { name: "Remaining", value: 100 - rsi, fill: "var(--muted)" },
        ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Momentum</CardTitle>
        <CardDescription>Relative strength · 14 periods</CardDescription>
        <CardAction>
          <Badge variant="outline">RSI</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        {rsi === null ? (
          <p className="text-muted-foreground text-sm">More candle history is needed to calculate RSI.</p>
        ) : (
          <>
            <ChartContainer
              config={{ value: { label: "RSI", color: "var(--color-emerald-500)" } }}
              className="aspect-square size-28 shrink-0"
            >
              <PieChart>
                <Pie
                  data={points}
                  dataKey="value"
                  innerRadius={36}
                  outerRadius={49}
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={3}
                  cornerRadius={5}
                  strokeWidth={0}
                  isAnimationActive={false}
                >
                  <Label
                    content={({ viewBox }) =>
                      viewBox && "cx" in viewBox && "cy" in viewBox ? (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} dy="-4" className="fill-foreground font-semibold text-xl">
                            {rsi.toFixed(1)}
                          </tspan>
                          <tspan x={viewBox.cx} dy="22" className="fill-muted-foreground text-xs">
                            of 100
                          </tspan>
                        </text>
                      ) : null
                    }
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground text-xs">30 · Oversold</span>
              <Badge variant="secondary">{label}</Badge>
              <span className="text-muted-foreground text-xs">70 · Overbought</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
