"use client";

import { useEffect, useRef, useState } from "react";

import { marketSourceLabel, normalizeInstrumentSymbol, referenceMarkets } from "@marketpilot/market-data";
import { cn } from "cn";
import { ChevronsUpDown, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { useMarketCatalog } from "./market-catalog-provider";

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
  compact = false,
  size = "default",
  favorites,
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
  compact?: boolean;
  size?: "default" | "sm";
  favorites?: { symbols: string[]; toggle: (symbol: string) => void; ready: boolean };
}) {
  const [open, setOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const favoriteButtons = useRef(new Map<string, HTMLButtonElement>());
  const pendingFavoriteFocus = useRef<string | null>(null);
  useEffect(() => {
    const symbol = pendingFavoriteFocus.current;
    if (symbol) {
      (favoriteButtons.current.get(symbol) ?? searchInput.current)?.focus();
      pendingFavoriteFocus.current = null;
    }
  });
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
  const favoriteMatches = favorites ? matches.filter((market) => favorites.symbols.includes(market.symbol)) : [];
  const regularMatches = favorites ? matches.filter((market) => !favorites.symbols.includes(market.symbol)) : matches;
  const visible = query
    ? regularMatches.slice(0, 80)
    : (["crypto", "forex", "commodity", "stock"] as const).flatMap((type) =>
        regularMatches.filter((item) => item.assetClass === type).slice(0, 20),
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
          size={size}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          disabled={disabled}
          title={selected ? `${selected.name} · ${selected.symbol}` : value || undefined}
          className={cn("w-full justify-between", size === "default" && "h-10", className)}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            {value && !compact ? <AssetMark symbol={value} small /> : null}
            {selected ? (
              <>
                <span className="truncate">{selected.name}</span>
                {!compact && <span className="text-muted-foreground">{selected.symbol}</span>}
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
            ref={searchInput}
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
            {[
              { key: "favorites", title: "Favorites", markets: favoriteMatches },
              ...(["crypto", "forex", "commodity", "stock"] as const).map((assetClass) => ({
                key: assetClass,
                title: { crypto: "Crypto", forex: "Forex", commodity: "Metals", stock: "Stocks" }[assetClass],
                markets: visible.filter((market) => market.assetClass === assetClass),
              })),
            ]
              .filter((group) => group.markets.length > 0)
              .map((group) => (
                <CommandGroup key={group.key} heading={group.title}>
                  {group.markets.map((market) => (
                    <div
                      key={market.symbol}
                      className="flex items-center rounded-sm pr-1 hover:bg-muted focus-within:bg-muted has-[[data-selected=true]]:bg-muted"
                    >
                      <CommandItem
                        className="min-w-0 flex-1 data-selected:bg-transparent"
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
                            <span className="text-muted-foreground text-xs">
                              Market data needs a provider connection
                            </span>
                          ) : null}
                        </span>
                      </CommandItem>
                      {favorites ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={!favorites.ready}
                          aria-label={`${favorites.symbols.includes(market.symbol) ? "Remove" : "Add"} ${market.name} (${market.symbol}) ${favorites.symbols.includes(market.symbol) ? "from" : "to"} favorites`}
                          aria-pressed={favorites.symbols.includes(market.symbol)}
                          ref={(node) => {
                            if (node) favoriteButtons.current.set(market.symbol, node);
                            else favoriteButtons.current.delete(market.symbol);
                          }}
                          onPointerDown={(event) => event.stopPropagation()}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") event.stopPropagation();
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            pendingFavoriteFocus.current = market.symbol;
                            favorites.toggle(market.symbol);
                          }}
                        >
                          <Star
                            className={
                              favorites.symbols.includes(market.symbol)
                                ? "fill-amber-500 text-amber-500"
                                : "text-muted-foreground"
                            }
                          />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </CommandGroup>
              ))}
          </CommandList>
          {catalog.loading ? (
            <p role="status" className="border-t p-2 text-muted-foreground text-xs">
              Loading market catalog…
            </p>
          ) : null}
          {matches.length > visible.length + favoriteMatches.length ? (
            <p className="p-2 text-muted-foreground text-xs">
              Showing {visible.length + favoriteMatches.length} of {matches.length}. Type to narrow the list.
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
