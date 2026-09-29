"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const sampleUsage = [
  { day: "Mon", requests: 1240 },
  { day: "Tue", requests: 1680 },
  { day: "Wed", requests: 1420 },
  { day: "Thu", requests: 2110 },
  { day: "Fri", requests: 1840 },
  { day: "Sat", requests: 920 },
  { day: "Sun", requests: 1110 },
];

const chartConfig = {
  requests: { label: "Example requests", color: "var(--color-chart-2)" },
} satisfies ChartConfig;

export function UsageChart() {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
      <BarChart accessibilityLayer data={sampleUsage} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="day" axisLine={false} tickLine={false} tickMargin={10} />
        <YAxis axisLine={false} tickLine={false} width={42} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="requests" fill="var(--color-requests)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
