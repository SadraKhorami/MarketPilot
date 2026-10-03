"use client";

import Link from "next/link";

import { ChartCandlestick } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function MarketDetailsLink({ symbol }: { symbol: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" asChild>
          <Link
            href={`/dashboard/markets/${encodeURIComponent(symbol)}`}
            aria-label={`Open ${symbol} chart and analysis`}
          >
            <ChartCandlestick data-icon="inline-start" />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Chart & analysis · {symbol}</TooltipContent>
    </Tooltip>
  );
}
