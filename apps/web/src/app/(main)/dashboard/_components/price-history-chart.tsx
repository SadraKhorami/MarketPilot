"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { PricePoint } from "@/data/marketpilot";

const chartConfig = {
  price: { label: "MarketFeed candle close", color: "var(--color-chart-2)" },
} satisfies ChartConfig;

function formatAxisPrice(value: number) {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

export function PriceHistoryChart({ data }: { data: PricePoint[] }) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[260px] w-full sm:h-[320px]">
      <AreaChart accessibilityLayer data={data} margin={{ left: 4, right: 12, top: 10, bottom: 0 }}>
        <defs>
          <linearGradient id="priceFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-price)" stopOpacity={0.24} />
            <stop offset="100%" stopColor="var(--color-price)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="time" axisLine={false} tickLine={false} tickMargin={10} minTickGap={28} />
        <YAxis axisLine={false} tickLine={false} width={76} tickFormatter={formatAxisPrice} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
        <Area dataKey="price" type="monotone" stroke="var(--color-price)" strokeWidth={2} fill="url(#priceFill)" />
      </AreaChart>
    </ChartContainer>
  );
}
