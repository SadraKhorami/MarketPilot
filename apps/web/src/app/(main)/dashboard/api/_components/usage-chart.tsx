"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const chartConfig = {
  requests: { label: "Requests", color: "var(--color-chart-2)" },
} satisfies ChartConfig;

export function UsageChart({ data }: { data: Array<{ day: string; requests: number }> }) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
      <BarChart accessibilityLayer data={data} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="day"
          tickFormatter={(day: string) =>
            new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            })
          }
          axisLine={false}
          tickLine={false}
          tickMargin={10}
        />
        <YAxis axisLine={false} tickLine={false} width={42} allowDecimals={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="requests" fill="var(--color-requests)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
