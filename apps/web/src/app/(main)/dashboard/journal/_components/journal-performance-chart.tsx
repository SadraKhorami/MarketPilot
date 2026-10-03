"use client";
import type { JournalAnalytics } from "@marketpilot/ai/contracts";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { chartPrice } from "../../_components/market-chart-utils";
export function JournalPerformanceChart({ data, mode }: { data: JournalAnalytics; mode: string }) {
  const daily = mode === "net";
  const Chart = daily ? BarChart : AreaChart;
  return (
    <ChartContainer
      config={{
        cumulative: { label: `Cumulative · ${data.quote}`, color: "var(--chart-1)" },
        net: { label: `Daily net · ${data.quote}`, color: "var(--chart-1)" },
      }}
      className="h-80 w-full"
    >
      <Chart data={data.series} accessibilityLayer margin={{ left: 4, right: 12, top: 16 }}>
        <defs>
          <linearGradient id="journal-pnl-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-cumulative)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--color-cumulative)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          minTickGap={35}
          tickMargin={10}
          tickFormatter={(day: string) =>
            new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            })
          }
        />
        <YAxis tickLine={false} axisLine={false} width={65} tickFormatter={(value) => chartPrice(Number(value))} />
        <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
        <ChartTooltip content={<ChartTooltipContent />} />
        {daily ? (
          <Bar dataKey="net" fill="var(--color-net)" radius={4} maxBarSize={40} />
        ) : (
          <Area
            type="linear"
            dataKey="cumulative"
            stroke="var(--color-cumulative)"
            strokeWidth={2}
            fill="url(#journal-pnl-fill)"
            dot={data.series.length === 1}
          />
        )}
      </Chart>
    </ChartContainer>
  );
}
