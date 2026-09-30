import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";

export function MarketPilotPage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="@container/main mx-auto flex w-full max-w-screen-2xl flex-col gap-5 md:gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="font-semibold text-2xl tracking-tight sm:text-3xl">{title}</h1>
          <p className="max-w-3xl text-muted-foreground text-sm">{description}</p>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}

export function FixtureNote({ children = "Illustrative fixture · not live market data" }: { children?: ReactNode }) {
  return <span className="text-muted-foreground text-xs">{children}</span>;
}

export function ChangeText({ value }: { value: number }) {
  const isPositive = value >= 0;
  return (
    <span
      className={
        isPositive
          ? "font-medium text-emerald-600 dark:text-emerald-400"
          : "font-medium text-rose-600 dark:text-rose-400"
      }
    >
      {isPositive ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}

export function StatusBadge({ value }: { value: string }) {
  let style = "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (value === "Bullish" || value === "Positive" || value === "Active") {
    style = "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  } else if (value === "Bearish" || value === "Negative" || value === "Paused") {
    style = "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }
  return (
    <Badge variant="outline" className={style}>
      {value}
    </Badge>
  );
}
