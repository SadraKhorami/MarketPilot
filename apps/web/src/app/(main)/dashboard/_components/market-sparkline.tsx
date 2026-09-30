"use client";

import { useId } from "react";

import { cn } from "cn";

export function MarketSparkline({
  values,
  positive = true,
  className,
}: {
  values: number[];
  positive?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  if (values.length < 2) return null;
  const minimum = Math.min(...values);
  const range = Math.max(...values) - minimum || 1;
  const points = values
    .map((value, index) => `${(index / (values.length - 1)) * 240},${52 - ((value - minimum) / range) * 44}`)
    .join(" ");
  return (
    <svg
      viewBox="0 0 240 60"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("h-16 w-full", positive ? "text-emerald-600" : "text-rose-500", className)}
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.18} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={`0,60 ${points} 240,60`} fill={`url(#${id})`} />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
