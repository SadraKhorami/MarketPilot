"use client";

import { useState } from "react";

import { marketSourceLabel, normalizeInstrumentSymbol, referenceMarkets } from "@marketpilot/market-data";
import { useMarketCatalog } from "./market-catalog-provider";
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
  return (
    marketOptions.find((market) => market.symbol === symbol)?.name ??
    referenceMarkets.find((market) => market.symbol === symbol)?.name ??
    symbol.split("-")[0]
  );
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
  return normalizeInstrumentSymbol(value);
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
  allowUnavailable = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowAll?: boolean;
  excluded?: string[];
  allowUnavailable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const catalog = useMarketCatalog();
  const [search, setSearch] = useState("");
  const instruments = catalog.data?.instruments ?? [];
  const selected = instruments.find((market) => market.symbol === value);
  const query = search.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const matches = instruments.filter((market) =>
    `${market.name}${market.symbol}${market.providerSymbol}${market.assetClass}`
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, "")
      .includes(query),
  );
  const visible = query
    ? matches.slice(0, 80)
    : (["crypto", "forex", "commodity", "stock"] as const).flatMap((type) =>
        matches.filter((item) => item.assetClass === type).slice(0, 20),
      );
  const select = (symbol: string) => {
    onChange(symbol);
    setOpen(false);
  };
  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) setSearch("");
      }}
    >
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
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search name or symbol, e.g. Bitcoin, XAUUSD…"
            aria-label="Search markets by name or symbol"
          />
          <CommandList id={`${id}-list`} className="max-h-72 overflow-y-auto overscroll-contain">
            <CommandEmpty>{catalog.loading ? "Loading market catalog…" : "No matching instrument."}</CommandEmpty>
            {allowAll && !query ? (
              <CommandGroup>
                <CommandItem value="all" onSelect={() => select("")}>
                  All assets
                </CommandItem>
              </CommandGroup>
            ) : null}
            {(["crypto", "forex", "commodity", "stock"] as const).map((assetClass) => {
              const group = visible.filter((market) => market.assetClass === assetClass);
              if (!group.length) return null;
              return (
                <CommandGroup
                  key={assetClass}
                  heading={{ crypto: "Crypto", forex: "Forex", commodity: "Metals", stock: "Stocks" }[assetClass]}
                >
                  {group.map((market) => (
                    <CommandItem
                      key={market.symbol}
                      value={market.symbol}
                      disabled={excluded.includes(market.symbol) || (!market.available && !allowUnavailable)}
                      onSelect={() => select(market.symbol)}
                    >
                      <AssetMark symbol={market.symbol} small />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{market.name}</span>
                        <span className="truncate text-muted-foreground text-xs">
                          {market.symbol} · {marketSourceLabel(market.provider)}
                        </span>
                        {!market.available ? (
                          <span className="text-muted-foreground text-xs">Market data needs a provider connection</span>
                        ) : null}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
          {catalog.loading ? (
            <p role="status" className="border-t p-2 text-muted-foreground text-xs">
              Loading market catalog…
            </p>
          ) : null}
          {matches.length > visible.length ? (
            <p className="p-2 text-muted-foreground text-xs">
              Showing {visible.length} of {matches.length}. Type to narrow the list.
            </p>
          ) : null}
          {catalog.error || catalog.data?.error ? (
            <div className="flex items-center justify-between gap-2 border-t p-2">
              <span className="text-muted-foreground text-xs">{catalog.error || catalog.data?.error}</span>
              <Button size="sm" variant="ghost" onClick={catalog.reload}>
                Retry
              </Button>
            </div>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
