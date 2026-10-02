"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MarketSymbolField } from "../../_components/market-symbol-field";
export interface ResearchWatchlist {
  id: string;
  name: string;
  items: Array<{ assetId: string }>;
}
interface Props {
  symbol: string;
  onSymbolChange: (symbol: string) => void;
  watchlistId: string;
  onWatchlistChange: (id: string) => void;
  lists: ResearchWatchlist[] | null;
  listsLoading: boolean;
  listsError: string | null;
  disabled: boolean;
  running: boolean;
  onSubmit: (prompt: string) => void;
}
function QuestionChoices({
  symbol,
  onSymbolChange,
  watchlistId,
  onWatchlistChange,
  lists,
  listsLoading,
  listsError,
  disabled,
  running,
  onSubmit,
  compact = false,
}: Props & { compact?: boolean }) {
  const prefix = compact ? "followup" : "starter";
  return (
    <div className="flex flex-col gap-4">
      <div className={compact ? "flex flex-col gap-5" : "grid gap-6 md:grid-cols-2 md:gap-8"}>
        <section className="flex min-w-0 flex-col gap-3" aria-label="Market questions">
          <Field>
            <FieldLabel htmlFor={`${prefix}-market`}>Research a market</FieldLabel>
            <MarketSymbolField id={`${prefix}-market`} value={symbol} onChange={onSymbolChange} disabled={running} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-10 whitespace-normal py-2 text-left"
              disabled={disabled}
              onClick={() =>
                onSubmit(
                  `Analyze ${symbol} using current price, technical indicators, trend and available stored news.`,
                )
              }
            >
              Analyze {symbol.split("-")[0]}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-10 whitespace-normal py-2 text-left"
              disabled={disabled}
              onClick={() =>
                onSubmit(
                  `Give me a conditional BUY or SELL trade setup for ${symbol} after a pullback and confirmation, with Entry, Stop loss, TP 1 and TP 2. Use current completed candles. If there is no valid setup, say so. Offer an optional near-entry alert, but do not create it without my confirmation.`,
                )
              }
            >
              Entry, stop loss & targets
            </Button>
          </div>
        </section>
        <section className="flex min-w-0 flex-col gap-3" aria-label="Watchlist questions">
          <Field>
            <FieldLabel htmlFor={`${prefix}-watchlist`}>Research your watchlist</FieldLabel>
            <Select
              value={watchlistId}
              onValueChange={onWatchlistChange}
              disabled={running || listsLoading || !!listsError || !lists?.length}
            >
              <SelectTrigger id={`${prefix}-watchlist`} className="h-10! w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="default">{lists?.[0]?.name ?? "First watchlist"}</SelectItem>
                  {lists?.slice(1).map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name} · {list.items.length} assets
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Button
            type="button"
            variant="outline"
            className="min-h-10"
            disabled={disabled || !!listsError || !lists?.length}
            onClick={() =>
              onSubmit("Summarize my selected watchlist with actual market observations and their limitations.")
            }
          >
            Summarize my watchlist
          </Button>
          {listsError ? <p className="text-muted-foreground text-xs">Watchlists could not be loaded.</p> : null}
          {lists?.length === 0 ? (
            <p className="text-muted-foreground text-xs">Add a watchlist to research your saved markets.</p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
export function ResearchSuggestions(props: Props & { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!props.compact) return <QuestionChoices {...props} />;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          Suggested questions
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-[70dvh] w-96 max-w-[calc(100vw-2rem)] overflow-y-auto p-4">
        <QuestionChoices
          {...props}
          compact
          onSubmit={(prompt) => {
            setOpen(false);
            props.onSubmit(prompt);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
