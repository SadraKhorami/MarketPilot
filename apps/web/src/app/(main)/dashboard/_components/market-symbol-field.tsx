"use client";

import { useState } from "react";

import { cn } from "cn";
import { ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const marketOptions = [
  { symbol: "BTC-USD", name: "Bitcoin", mark: "₿" },
  { symbol: "ETH-USD", name: "Ethereum", mark: "Ξ" },
  { symbol: "SOL-USD", name: "Solana", mark: "S" },
  { symbol: "XRP-USD", name: "XRP", mark: "X" },
  { symbol: "ADA-USD", name: "Cardano", mark: "A" },
  { symbol: "DOGE-USD", name: "Dogecoin", mark: "Ð" },
  { symbol: "LTC-USD", name: "Litecoin", mark: "Ł" },
  { symbol: "AVAX-USD", name: "Avalanche", mark: "A" },
] as const;
export const suggestedMarketSymbols = marketOptions.map((market) => market.symbol) as string[];

export function marketName(symbol: string) {
  return marketOptions.find((market) => market.symbol === symbol)?.name ?? symbol.split("-")[0];
}

export function AssetMark({ symbol, small = false }: { symbol: string; small?: boolean }) {
  const market = marketOptions.find((item) => item.symbol === symbol);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary",
        small ? "size-7 text-xs" : "size-10 text-lg",
      )}
    >
      {market?.mark ?? symbol.slice(0, 1)}
    </span>
  );
}

export function normalizeMarketSymbol(value: string) {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/\s*\/\s*/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return /^[A-Z0-9]+$/.test(normalized) ? `${normalized}-USD` : normalized;
}

export function MarketSymbolField({
  id,
  value,
  onChange,
  placeholder = "Choose a market",
  disabled = false,
  className,
  allowAll = false,
  excluded = [],
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowAll?: boolean;
  excluded?: string[];
}) {
  const [open, setOpen] = useState(false);
  const selected = marketOptions.find((market) => market.symbol === value);
  const select = (symbol: string) => {
    onChange(symbol);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          disabled={disabled}
          className={cn("h-10 w-full justify-between", className)}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            {value ? <AssetMark symbol={value} small /> : null}
            {selected ? (
              <>
                <span>{selected.name}</span>
                <span className="text-muted-foreground">{selected.symbol}</span>
              </>
            ) : (
              value || (allowAll ? "All assets" : placeholder)
            )}
          </span>
          <ChevronsUpDown data-icon="inline-end" className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-64 max-w-[calc(100vw-2rem)] p-0">
        <Command>
          <CommandInput placeholder="Search Bitcoin, Ethereum, BTC…" aria-label="Search markets by name or symbol" />
          <CommandList id={`${id}-list`} className="max-h-72 overflow-y-auto overscroll-contain">
            <CommandEmpty>No matching asset. Try a name or symbol.</CommandEmpty>
            <CommandGroup heading="USD markets">
              {allowAll ? (
                <CommandItem value="All assets" onSelect={() => select("")} data-checked={!value}>
                  All assets
                </CommandItem>
              ) : null}
              {marketOptions.map((market) => (
                <CommandItem
                  key={market.symbol}
                  value={market.symbol}
                  keywords={[market.name, market.symbol.split("-")[0]]}
                  disabled={excluded.includes(market.symbol)}
                  onSelect={() => select(market.symbol)}
                  data-checked={value === market.symbol}
                  className="gap-3 py-2.5"
                >
                  <AssetMark symbol={market.symbol} small />
                  <span className="flex flex-1 flex-col">
                    <span className="font-medium">{market.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {market.symbol}
                      {excluded.includes(market.symbol) ? " · Already followed" : ""}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
