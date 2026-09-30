"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";

import type { MarketObservation } from "@marketpilot/market-data";
import {
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  CandlestickChart,
  Check,
  FileText,
  GitCompareArrows,
  ListFilter,
  LockKeyhole,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { type ApiEnvelope, apiRequest } from "@/lib/api/client";

import { AssetMark, MarketSymbolField, marketName } from "../../_components/market-symbol-field";

const prompts = [
  {
    title: "Analyze an asset",
    description: "Price action, momentum and key levels",
    prompt: "Analyze BTC",
    icon: CandlestickChart,
  },
  {
    title: "Compare two markets",
    description: "Explore relative strength and volatility",
    prompt: "Compare BTC and ETH",
    icon: GitCompareArrows,
  },
  {
    title: "Get the market brief",
    description: "A focused overview of today’s market",
    prompt: "Summarize today's market",
    icon: BookOpen,
  },
  {
    title: "Review my watchlist",
    description: "Understand changes in the assets you follow",
    prompt: "What changed in my watchlist?",
    icon: ListFilter,
  },
];
type Context = {
  market: { data: MarketObservation; freshness: string } | null;
  news: Array<{ id: string; title: string; source: string; originalUrl: string }>;
};

export function AIAnalystWorkspace() {
  const [draft, setDraft] = useState("");
  const [savedDrafts, setSavedDrafts] = useState<string[]>([]);
  const [symbol, setSymbol] = useState("BTC-USD");
  const [context, setContext] = useState<Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [contextError, setContextError] = useState(false);
  const composer = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let disposed = false;
    setContext(null);
    setLoading(true);
    setContextError(false);
    const load = async () => {
      const results = await Promise.allSettled([
        apiRequest<ApiEnvelope<NonNullable<Context["market"]>>>(`/market-data/${symbol}?interval=15m`),
        apiRequest<ApiEnvelope<{ articles: Context["news"] }>>(`/news?asset=${symbol}&pageSize=3`),
      ]);
      if (disposed) return;
      setContext({
        market: results[0].status === "fulfilled" ? results[0].value.data : null,
        news: results[1].status === "fulfilled" ? results[1].value.data.articles : [],
      });
      setContextError(results.some((result) => result.status === "rejected"));
      setLoading(false);
    };
    void load();
    return () => {
      disposed = true;
    };
  }, [symbol]);

  const choosePrompt = (prompt: string) => {
    setDraft(prompt);
    composer.current?.focus();
  };
  const saveDraft = () => {
    if (draft.trim()) setSavedDrafts((current) => [...new Set([draft.trim(), ...current])].slice(0, 3));
  };
  const market = context?.market?.data;

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="min-w-0">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            MarketPilot Analyst
          </CardTitle>
          <CardDescription>Your workspace for evidence-based market research</CardDescription>
          <CardAction>
            <Badge variant="outline">Preview</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-7">
          <div className="flex flex-col items-center gap-3 pt-5 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="size-7" />
            </span>
            <h2 className="font-semibold text-2xl tracking-tight">What would you like to explore?</h2>
            <p className="max-w-md text-muted-foreground text-sm leading-6">
              Build a research question, choose an asset and review its sources. AI answers will become available when
              the analyst service is connected.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {prompts.map((item) => (
              <Button
                key={item.title}
                type="button"
                variant="outline"
                className="h-auto justify-start whitespace-normal p-4 text-left"
                onClick={() => choosePrompt(item.prompt)}
              >
                <item.icon data-icon="inline-start" className="self-start text-primary" />
                <span className="flex flex-col gap-1">
                  <span>{item.title}</span>
                  <span className="font-normal text-muted-foreground text-xs leading-5">{item.description}</span>
                </span>
              </Button>
            ))}
          </div>
          <Field>
            <FieldLabel htmlFor="analyst-draft">Your research question</FieldLabel>
            <InputGroup className="has-disabled:bg-transparent has-disabled:opacity-100 dark:has-disabled:bg-input/30">
              <InputGroupTextarea
                id="analyst-draft"
                ref={composer}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask about an asset, compare markets or explore your watchlist…"
                className="max-h-48 min-h-24"
              />
              <InputGroupAddon
                align="block-end"
                className="flex-col items-start justify-between sm:flex-row sm:items-center"
              >
                <span className="flex items-center gap-1.5 text-xs">
                  <LockKeyhole className="size-3" />
                  Draft only · no AI request sent
                </span>
                <div className="flex items-center gap-2 self-end">
                  <InputGroupButton variant="outline" disabled={!draft.trim()} onClick={saveDraft}>
                    Save draft
                  </InputGroupButton>
                  <InputGroupButton size="icon-sm" disabled aria-label="Send question — AI service not connected">
                    <ArrowUp />
                  </InputGroupButton>
                </div>
              </InputGroupAddon>
            </InputGroup>
          </Field>
          {savedDrafts.length ? (
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-1.5 font-medium text-xs">
                <Check className="size-3" />
                Saved for this visit
              </p>
              {savedDrafts.map((item) => (
                <Button
                  key={item}
                  variant="ghost"
                  className="h-auto justify-start truncate py-2"
                  onClick={() => choosePrompt(item)}
                >
                  <FileText data-icon="inline-start" />
                  <span className="truncate">{item}</span>
                </Button>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
      <aside className="flex min-w-0 flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Research context</CardTitle>
            <CardDescription>Actual data for your selected market</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="analyst-market">Asset</FieldLabel>
              <MarketSymbolField id="analyst-market" value={symbol} onChange={setSymbol} />
            </Field>
            {loading ? <Skeleton className="h-24 w-full" /> : null}
            {!loading && market ? (
              <div className="flex flex-col gap-3 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <AssetMark symbol={symbol} small />
                  <span className="font-medium text-sm">{marketName(symbol)}</span>
                  <Badge variant="outline" className="ml-auto">
                    {context?.market?.freshness === "stale" ? "Cached" : "Observed"}
                  </Badge>
                </div>
                <p className="font-semibold text-xl tabular-nums">
                  ${market.price.toLocaleString(undefined, { maximumFractionDigits: market.price < 1 ? 6 : 2 })}
                </p>
                <p className="text-muted-foreground text-xs">
                  Coinbase Exchange · {new Date(market.timestamp).toLocaleTimeString()}
                </p>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/dashboard/markets/${symbol}`}>
                    Explore data <ArrowUpRight data-icon="inline-end" />
                  </Link>
                </Button>
              </div>
            ) : null}
            {!loading && !market ? (
              <p className="text-muted-foreground text-sm">Market data is currently unavailable.</p>
            ) : null}
            <div className="flex flex-col gap-2">
              <p className="font-medium text-xs">Related coverage</p>
              {context?.news.length ? (
                context.news.map((article) => (
                  <a
                    key={article.id}
                    href={article.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col gap-1 rounded-md border p-3 text-sm hover:bg-muted/50"
                  >
                    <span className="line-clamp-2">{article.title}</span>
                    <span className="text-muted-foreground text-xs">{article.source} ↗</span>
                  </a>
                ))
              ) : (
                <p className="text-muted-foreground text-xs">
                  {loading ? "Loading headlines…" : "No matching headlines for this asset."}
                </p>
              )}
            </div>
            {contextError ? (
              <p role="status" className="text-destructive text-xs">
                Some research sources could not be loaded.
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Research activity</CardTitle>
            <CardAction>
              <Badge variant="secondary">Idle</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm leading-6">
              No AI tools have run. When research is enabled, data lookups and cited sources will appear here.
            </p>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
