"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { PricePoint } from "@/data/marketpilot";

const chartConfig = {
  price: { label: "Coinbase Exchange candle close", color: "var(--color-chart-2)" },
} satisfies ChartConfig;

function formatAxisPrice(value: number, quoteCurrency: string) {
  const formatted = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(value);
  return quoteCurrency === "USD" ? `$${formatted}` : `${formatted} ${quoteCurrency}`;
}

export function PriceHistoryChart({ data, quoteCurrency = "USD" }: { data: PricePoint[]; quoteCurrency?: string }) {
  const values = data.map((point) => point.price);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const padding = Math.max((maximum - minimum) * 0.12, Math.abs(maximum) * 0.001, 0.000001);

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
        <YAxis
          axisLine={false}
          tickLine={false}
          width={76}
          tickCount={5}
          domain={[minimum - padding, maximum + padding]}
          tickFormatter={(value: number) => formatAxisPrice(value, quoteCurrency)}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent indicator="line" formatter={(value) => formatPrice(Number(value), quoteCurrency)} />
          }
        />
        <Area dataKey="price" type="monotone" stroke="var(--color-price)" strokeWidth={2} fill="url(#priceFill)" />
      </AreaChart>
    </ChartContainer>
  );
}

function formatPrice(value: number, quoteCurrency: string) {
  const formatted = new Intl.NumberFormat(undefined, { maximumFractionDigits: value < 1 ? 6 : 2 }).format(value);
  return quoteCurrency === "USD" ? `$${formatted}` : `${formatted} ${quoteCurrency}`;
}
